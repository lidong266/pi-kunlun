/**
 * CogScheduler — 多认知核心调度器
 *
 * 三策略调度决策树（设计文档第7.3节）：
 *   一级：共识截止时间（类比 EDF）— deadline 最近优先
 *   二级：矛盾优先级（类比 HPF 32级位图）— 矛盾尖锐优先
 *   三级：螺旋迭代（昆仑新增）— 收敛度最差优先
 *   空闲：自我进化/记忆归纳
 *
 * 参考 HarmonyOS LiteOS-A 的 OsSchedResched / OsSchedEnTaskQueue / OsSchedDeTaskQueue
 */

import type { Trit } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type {
  CogTaskCB,
  CogRunqueue,
  CogSchedPolicy,
  CogTaskType,
  CogTaskContext,
  CogKernelType,
  KernelAffinity,
  CogSchedStats,
  CogMessage,
} from './types';
import {
  CogTaskStatus,
  CogPriority,
  CogSignal,
  CogIPIType,
  CogIPIMessage,
  priorityFromLevel,
} from './types';

// ═══════════════════════════════════════════════════════════════
// CogScheduler 主类
// ═══════════════════════════════════════════════════════════════

export class CogScheduler {
  private taskArray: CogTaskCB[] = [];
  private runqueues = new Map<string, CogRunqueue>();
  private taskIdCounter = 0;
  private completedTasks: CogTaskCB[] = [];
  private errorTasks: CogTaskCB[] = [];
  private timeoutTasks: CogTaskCB[] = [];
  private statsInterval: ReturnType<typeof setInterval> | null = null;

  // ─── 实例管理 ──────────────────────────────────

  /** 注册一个认知核心实例 */
  registerInstance(instanceId: string): CogRunqueue {
    if (this.runqueues.has(instanceId)) {
      return this.runqueues.get(instanceId)!;
    }
    const rq: CogRunqueue = {
      instanceId,
      contradictionQueue: new Map(),
      contradictionBitmap: 0,
      consensusQueue: [],
      spiralQueue: [],
      ttlQueue: [],
      idleTask: null,
      currentTask: null,
      lockCount: 0,
      schedFlag: 0,
    };
    this.runqueues.set(instanceId, rq);
    return rq;
  }

  /** 注销实例 */
  unregisterInstance(instanceId: string): void {
    const rq = this.runqueues.get(instanceId);
    if (rq) {
      this.taskArray = this.taskArray.filter(t => t.kernelAffinity.currentInstance !== instanceId);
      this.runqueues.delete(instanceId);
    }
  }

  getInstanceIds(): string[] {
    return [...this.runqueues.keys()];
  }

  // ─── 任务创建 ──────────────────────────────────

  /** 创建认知任务（类比 LosTaskCreate） */
  createTask(params: {
    name: string;
    type: CogTaskType;
    policy?: CogSchedPolicy;
    kernelAffinity?: Partial<KernelAffinity>;
    context: CogTaskContext;
    tokenBudget?: number;
    priority?: CogPriority;
  }): CogTaskCB {
    const id = `cog-task-${++this.taskIdCounter}-${Date.now()}`;
    const now = Date.now();

    const task: CogTaskCB = {
      id,
      name: params.name,
      type: params.type,
      status: CogTaskStatus.INIT,
      priority: params.priority ?? CogPriority.NORMAL,
      startTime: 0,
      totalRuntime: 0,
      irqUsedTime: 0,
      policy: params.policy ?? { type: 'idle' },
      kernelAffinity: {
        preferredKernel: params.kernelAffinity?.preferredKernel ?? 'pi-agent',
        currentInstance: params.kernelAffinity?.currentInstance ?? '',
        lastInstance: params.kernelAffinity?.lastInstance ?? '',
        allowedInstances: params.kernelAffinity?.allowedInstances ?? [],
      },
      context: params.context,
      signal: CogSignal.NONE,
      tokenBudget: params.tokenBudget ?? 4000,
      createdAt: now,
      updatedAt: now,
    };

    this.taskArray.push(task);
    return task;
  }

  // ─── 任务入队 ──────────────────────────────────

  /** 将任务加入运行队列 */
  enqueueTask(task: CogTaskCB, instanceId: string): void {
    const rq = this.runqueues.get(instanceId);
    if (!rq) throw new Error(`Instance ${instanceId} not registered`);

    task.status = CogTaskStatus.READY;
    task.kernelAffinity.currentInstance = instanceId;
    task.updatedAt = Date.now();

    switch (task.policy.type) {
      case 'consensus-deadline':
        this.enqueueConsensus(rq, task);
        break;
      case 'contradiction-priority':
        this.enqueueContradiction(rq, task);
        break;
      case 'spiral-iteration':
        this.enqueueSpiral(rq, task);
        break;
      default:
        rq.ttlQueue.push(task);
        break;
    }
  }

  private enqueueConsensus(rq: CogRunqueue, task: CogTaskCB): void {
    rq.consensusQueue.push(task);
    // 按 deadline 升序排列
    rq.consensusQueue.sort((a, b) => {
      const da = (a.policy as { deadline: number }).deadline;
      const db = (b.policy as { deadline: number }).deadline;
      return da - db;
    });
  }

  private enqueueContradiction(rq: CogRunqueue, task: CogTaskCB): void {
    const prio = task.priority;
    const list = rq.contradictionQueue.get(prio) || [];
    list.push(task);
    rq.contradictionQueue.set(prio, list);
    // 设置位图
    rq.contradictionBitmap |= (1 << prio);
  }

  private enqueueSpiral(rq: CogRunqueue, task: CogTaskCB): void {
    rq.spiralQueue.push(task);
    // 按收敛度升序（收敛度最差优先）
    rq.spiralQueue.sort((a, b) => {
      const ca = (a.policy as { convergenceScore: number }).convergenceScore;
      const cb = (b.policy as { convergenceScore: number }).convergenceScore;
      return ca - cb;
    });
  }

  // ─── 核心调度：topCogTaskGet ──────────────────

  /**
   * 三策略调度决策树（设计文档第7.3节核心算法）
   * 类比 LiteOS-A 的 OsSchedNextTask / topTaskGet
   */
  topCogTaskGet(rq: CogRunqueue): CogTaskCB | null {
    // 一级：共识截止时间（EDF）— deadline 最近优先
    const consensusTask = this.consensusQueueTopTaskGet(rq);
    if (consensusTask) return consensusTask;

    // 二级：矛盾优先级（HPF 32级位图）— 矛盾尖锐优先
    const contradictionTask = this.contradictionQueueTopTaskGet(rq);
    if (contradictionTask) return contradictionTask;

    // 三级：螺旋迭代 — 收敛度最差优先
    const spiralTask = this.spiralQueueTopTaskGet(rq);
    if (spiralTask) return spiralTask;

    // 空闲：返回 idle task
    return rq.idleTask;
  }

  private consensusQueueTopTaskGet(rq: CogRunqueue): CogTaskCB | null {
    if (rq.consensusQueue.length === 0) return null;
    const task = rq.consensusQueue[0]!;
    // 检查 deadline 是否已过
    const deadline = (task.policy as { deadline: number }).deadline;
    if (deadline > 0 && Date.now() > deadline) {
      // deadline 已过，移出并标记超时
      rq.consensusQueue.shift();
      task.status = CogTaskStatus.TIMEOUT;
      this.timeoutTasks.push(task);
      // 递归尝试下一个
      return this.consensusQueueTopTaskGet(rq);
    }
    return task;
  }

  private contradictionQueueTopTaskGet(rq: CogRunqueue): CogTaskCB | null {
    if (rq.contradictionBitmap === 0) return null;
    // 从高位（最紧急）向低位扫描
    for (let prio = CogPriority.CRITICAL; prio >= CogPriority.IDLE; prio--) {
      if (rq.contradictionBitmap & (1 << prio)) {
        const list = rq.contradictionQueue.get(prio as CogPriority);
        if (list && list.length > 0) {
          const task = list.shift()!;
          if (list.length === 0) {
            rq.contradictionQueue.delete(prio as CogPriority);
            rq.contradictionBitmap &= ~(1 << prio);
          }
          return task;
        }
      }
    }
    return null;
  }

  private spiralQueueTopTaskGet(rq: CogRunqueue): CogTaskCB | null {
    if (rq.spiralQueue.length === 0) return null;
    return rq.spiralQueue.shift()!;
  }

  // ─── 重新调度（类比 OsSchedResched） ──────────

  /**
   * 重新调度指定实例
   * 类比 LiteOS-A 的 OsSchedResched 函数
   */
  async reschedule(instanceId: string): Promise<void> {
    const rq = this.runqueues.get(instanceId);
    if (!rq) return;

    const currentTask = rq.currentTask;
    const nextTask = this.topCogTaskGet(rq);

    if (currentTask === nextTask) return;

    // 挂起当前任务
    if (currentTask) {
      currentTask.status &= ~CogTaskStatus.RUNNING;
      currentTask.status |= CogTaskStatus.READY;
      currentTask.totalRuntime += Date.now() - (currentTask.startTime || Date.now());
    }

    if (!nextTask) return;

    // 启动下一个任务
    nextTask.status |= CogTaskStatus.RUNNING;
    nextTask.startTime = Date.now();
    nextTask.kernelAffinity.lastInstance = nextTask.kernelAffinity.currentInstance;
    nextTask.kernelAffinity.currentInstance = instanceId;
    rq.currentTask = nextTask;

    await this.executeTask(nextTask, instanceId);
  }

  // ─── 任务执行 ──────────────────────────────────

  private async executeTask(task: CogTaskCB, instanceId: string): Promise<void> {
    try {
      const result = await task.context.executor(task.context);
      task.context.output = result;
      task.status = CogTaskStatus.EXIT;
      task.totalRuntime = Date.now() - task.startTime;
      this.completedTasks.push(task);
    } catch (err) {
      task.context.error = err as Error;
      task.status = CogTaskStatus.ERROR;
      task.totalRuntime = Date.now() - task.startTime;
      this.errorTasks.push(task);
    }

    const rq = this.runqueues.get(instanceId);
    if (rq) {
      rq.currentTask = null;
    }

    // 触发下一轮调度
    await this.reschedule(instanceId);
  }

  // ─── 亲和性检查 ────────────────────────────────

  /** 检查任务是否可运行在指定实例上（类比 checkAffinity） */
  checkKernelAffinity(task: CogTaskCB, instanceId: string): boolean {
    const aff = task.kernelAffinity;
    if (aff.allowedInstances.length === 0) return true;
    return aff.allowedInstances.includes(instanceId);
  }

  // ─── 空闲实例查找（类比 IdleRunqueueFind） ────

  /** 找负载最小的实例 */
  idleInstanceFind(): string {
    let minLoad = Infinity;
    let targetId = '';

    for (const [id, rq] of this.runqueues) {
      const load = this.calculateInstanceLoad(rq);
      if (load < minLoad) {
        minLoad = load;
        targetId = id;
      }
    }

    return targetId || this.runqueues.keys().next().value || '';
  }

  private calculateInstanceLoad(rq: CogRunqueue): number {
    let load = rq.ttlQueue.length;
    load += rq.consensusQueue.length;
    load += rq.spiralQueue.length;
    for (const [, list] of rq.contradictionQueue) {
      load += list.length;
    }
    return load;
  }

  // ─── 垃圾回收（类比 CogTaskGC） ────────────────

  /** 回收已完成/超时/错误的任务 */
  collectGarbage(): number {
    let collected = 0;

    this.taskArray = this.taskArray.filter(task => {
      const shouldRemove =
        (task.status & CogTaskStatus.EXIT) !== 0 ||
        (task.status & CogTaskStatus.ERROR) !== 0 ||
        (task.status & CogTaskStatus.TIMEOUT) !== 0 ||
        (task.signal & CogSignal.KILL) !== 0;
      if (shouldRemove) collected++;
      return !shouldRemove;
    });

    return collected;
  }

  // ─── 超时管理 ──────────────────────────────────

  /** 检查并处理超时任务 */
  checkTimeouts(): CogTaskCB[] {
    const timedOut: CogTaskCB[] = [];
    const now = Date.now();

    for (const [id, rq] of this.runqueues) {
      // 检查 TTL 队列
      rq.ttlQueue = rq.ttlQueue.filter(task => {
        if (now - task.createdAt > 300000) { // 5分钟超时
          task.status = CogTaskStatus.TIMEOUT;
          this.timeoutTasks.push(task);
          timedOut.push(task);
          return false;
        }
        return true;
      });

      // 检查共识队列中的 deadline
      rq.consensusQueue = rq.consensusQueue.filter(task => {
        const deadline = (task.policy as { deadline: number }).deadline;
        if (deadline > 0 && now > deadline) {
          task.status = CogTaskStatus.TIMEOUT;
          this.timeoutTasks.push(task);
          timedOut.push(task);
          return false;
        }
        return true;
      });
    }

    return timedOut;
  }

  // ─── 跨实例 IPI ────────────────────────────────

  /** 向目标实例发送 IPI（类比 HalIrqSendIpi） */
  sendIPI(targetInstanceIds: string[], ipiType: CogIPIType, fromInstanceId: string): void {
    const message: CogIPIMessage = {
      type: 'ipi',
      ipiType,
      from: fromInstanceId,
    };

    for (const id of targetInstanceIds) {
      if (id === fromInstanceId) continue;
      const rq = this.runqueues.get(id);
      if (!rq) continue;

      switch (ipiType) {
        case CogIPIType.WAKEUP:
          // 唤醒空闲实例
          rq.schedFlag |= 1;
          break;
        case CogIPIType.SCHEDULE:
          // 触发重新调度
          this.reschedule(id);
          break;
        case CogIPIType.HALT:
          // 停止当前任务
          if (rq.currentTask) {
            rq.currentTask.signal |= CogSignal.HALT;
            rq.currentTask.status = CogTaskStatus.TIMEOUT;
          }
          break;
        case CogIPIType.FUNC_CALL:
          // 跨实例函数调用（在接收端处理）
          break;
      }
    }
  }

  // ─── 查询与统计 ────────────────────────────────

  getTask(taskId: string): CogTaskCB | undefined {
    return this.taskArray.find(t => t.id === taskId);
  }

  getCurrentTask(instanceId: string): CogTaskCB | null {
    return this.runqueues.get(instanceId)?.currentTask ?? null;
  }

  getTasks(): CogTaskCB[] {
    return [...this.taskArray];
  }

  getStats(): CogSchedStats {
    let totalRuntime = 0;
    let maxRuntime = 0;
    const instanceLoads: Record<string, number> = {};

    for (const [id, rq] of this.runqueues) {
      instanceLoads[id] = this.calculateInstanceLoad(rq);
    }

    for (const task of this.completedTasks) {
      totalRuntime += task.totalRuntime;
      if (task.totalRuntime > maxRuntime) maxRuntime = task.totalRuntime;
    }

    return {
      totalTasks: this.taskArray.length + this.completedTasks.length + this.errorTasks.length + this.timeoutTasks.length,
      completedTasks: this.completedTasks.length,
      timeoutTasks: this.timeoutTasks.length,
      errorTasks: this.errorTasks.length,
      avgRuntime: this.completedTasks.length > 0 ? totalRuntime / this.completedTasks.length : 0,
      maxRuntime,
      instanceLoads,
    };
  }

  /** 启动定时 GC */
  startGC(intervalMs = 30000): void {
    if (this.statsInterval) return;
    this.statsInterval = setInterval(() => {
      const collected = this.collectGarbage();
      const timeouts = this.checkTimeouts();
      if (collected > 0 || timeouts.length > 0) {
        // GC 完成
      }
    }, intervalMs);
  }

  /** 停止定时 GC */
  stopGC(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /** 重置调度器 */
  reset(): void {
    this.taskArray = [];
    this.runqueues.clear();
    this.completedTasks = [];
    this.errorTasks = [];
    this.timeoutTasks = [];
    this.taskIdCounter = 0;
    this.stopGC();
  }
}
