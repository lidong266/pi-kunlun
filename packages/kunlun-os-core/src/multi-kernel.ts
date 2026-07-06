/**
 * KunlunOS 多微内核调度器 v2 — 单用户认知并行
 *
 * 一个人同时运行多个认知任务：
 *
 *   用户提问 "分析这个项目的技术方案"
 *     │
 *     ├─ 主 Pi (前台对话)          ← prompt → LLM → tool → ... → 回复
 *     │   └─ 子代理线程池           ← 工具并行: read_file + web_search + grep
 *     │
 *     ├─ 子 Pi-1 (矛盾深度分析)    ← 独立 agent-loop: "从矛盾论角度分析X"
 *     │   └─ 子代理线程池           ← 工具并行
 *     │
 *     ├─ 子 Pi-2 (桥2视角分析)     ← 独立 agent-loop: "从系统科学角度分析X"
 *     │
 *     ├─ 子 Pi-3 (反事实推演)      ← 独立 agent-loop: "如果Y发生会怎样"
 *     │
 *     └─ 守护 Pi (记忆整理)        ← 空闲时: "归纳今天的对话要点"
 *
 * 每个 Pi = 完整 agent-loop (LLM调用 + 工具执行 + 认知注入)
 * 每个 Pi 内部 = 子代理线程池 (工具并行执行)
 * CogScheduler = EDF(用户等待) > HPF(矛盾紧急) > Spiral(收敛迭代) > IDLE(守护)
 */

import { CogScheduler, CogMultiInstanceManager, CogIPC, CogPriority } from '@kunlun/cogkal';
import type { CogTaskCB } from '@kunlun/cogkal';
import { KunlunAgent } from './kunlun-agent.js';
import type { KunlunAgentOptions } from './kunlun-agent.js';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { KunlunAnalysis } from './kunlun-os.js';

// ═══════════════════════════════════════════════════════════════
// Pi 内核描述
// ═══════════════════════════════════════════════════════════════

export interface PiKernel {
  id: string;
  role: KernelRole;
  agent: KunlunAgent;
  priority: CogPriority;
  /** 当前正在执行的任务数（包括子代理线程） */
  activeTaskCount: number;
  /** 累计执行任务数 */
  totalTaskCount: number;
}

export type KernelRole = 'main' | 'bridge' | 'counterfactual' | 'retrieval' | 'daemon';

// ═══════════════════════════════════════════════════════════════
// 认知任务
// ═══════════════════════════════════════════════════════════════

export interface CognitiveTask {
  id: string;
  type: 'user_prompt' | 'bridge_analysis' | 'counterfactual' | 'retrieval' | 'daemon';
  /** 任务描述（作为 system prompt） */
  description: string;
  /** 用户输入（作为 user message） */
  input: string;
  /** 优先级 */
  priority: CogPriority;
  /** 截止时间 (ms) */
  deadline: number;
  /** 分配的桥（bridge 类型任务） */
  bridgeId?: string;
  /** 结果回调 */
  onComplete?: (result: AssistantMessage) => void;
  /** 分析回调 */
  onAnalysis?: (analysis: KunlunAnalysis) => void;
}

// ═══════════════════════════════════════════════════════════════
// 内核池配置
// ═══════════════════════════════════════════════════════════════

export interface KernelPoolConfig {
  /** 桥分析内核数（每个桥一个Pi，并行多桥视角分析） */
  bridgeKernels?: number;
  /** 反事实推演内核数 */
  counterfactualKernels?: number;
  /** 检索内核数 */
  retrievalKernels?: number;
  /** 守护内核 */
  enableDaemon?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// MultiKernelOrchestrator v2
// ═══════════════════════════════════════════════════════════════

export class MultiKernelOrchestrator {
  private scheduler: CogScheduler;
  private multiInstance: CogMultiInstanceManager;
  private kernels: Map<string, PiKernel> = new Map();
  private taskQueue: CognitiveTask[] = [];
  private config: Required<KernelPoolConfig>;
  private baseOptions: KunlunAgentOptions;
  private taskCounter = 0;

  constructor(baseOptions: KunlunAgentOptions, config: KernelPoolConfig = {}) {
    this.config = {
      bridgeKernels: config.bridgeKernels ?? 3,
      counterfactualKernels: config.counterfactualKernels ?? 1,
      retrievalKernels: config.retrievalKernels ?? 1,
      enableDaemon: config.enableDaemon ?? true,
    };
    this.baseOptions = baseOptions;
    this.scheduler = new CogScheduler();
    this.multiInstance = new CogMultiInstanceManager(this.scheduler);
  }

  /**
   * 启动内核池
   * 1 main + N bridge + M counterfactual + K retrieval + 1 daemon
   */
  async start(): Promise<void> {
    // 主内核
    await this.spawnKernel('main', CogPriority.HIGH);

    // 桥分析内核（多桥并行）
    for (let i = 0; i < this.config.bridgeKernels; i++) {
      await this.spawnKernel('bridge', CogPriority.NORMAL);
    }

    // 反事实推演内核
    for (let i = 0; i < this.config.counterfactualKernels; i++) {
      await this.spawnKernel('counterfactual', CogPriority.NORMAL);
    }

    // 检索内核
    for (let i = 0; i < this.config.retrievalKernels; i++) {
      await this.spawnKernel('retrieval', CogPriority.NORMAL);
    }

    // 守护内核
    if (this.config.enableDaemon) {
      await this.spawnKernel('daemon', CogPriority.IDLE);
    }

    // 启动调度循环
    this.scheduler.startGC();
  }

  private async spawnKernel(role: KernelRole, priority: CogPriority): Promise<PiKernel> {
    const instanceId = `kunlun-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await this.multiInstance.spawnInstance(instanceId);

    const agent = new KunlunAgent({
      ...this.baseOptions,
      osConfig: { ...this.baseOptions.osConfig, instanceId },
    });
    await agent.start();

    const kernel: PiKernel = { id: instanceId, role, agent, priority, activeTaskCount: 0, totalTaskCount: 0 };
    this.kernels.set(instanceId, kernel);
    return kernel;
  }

  // ═══════════════════════════════════════════════════════════
  // 核心 API — 任务分发
  // ═══════════════════════════════════════════════════════════

  /** 用户主对话 */
  async prompt(text: string): Promise<AssistantMessage> {
    const kernel = this.getKernel('main');
    return this.executeOnKernel(kernel, {
      id: `user-${++this.taskCounter}`,
      type: 'user_prompt',
      description: '',
      input: text,
      priority: CogPriority.CRITICAL,
      deadline: Date.now() + 30000,
    });
  }

  /**
   * 多桥并行深度分析
   * 将一个问题的不同桥视角分发到多个桥内核并行执行
   */
  async analyzeFromBridges(
    query: string,
    bridgeIds: string[],
  ): Promise<Array<{ bridgeId: string; result: AssistantMessage }>> {
    const results = await Promise.all(
      bridgeIds.map(async (bridgeId) => {
        const kernel = this.getIdleKernel('bridge');
        const result = await this.executeOnKernel(kernel, {
          id: `bridge-${bridgeId}-${++this.taskCounter}`,
          type: 'bridge_analysis',
          description: `从${bridgeId}桥的学科视角，运用该桥的公理和学科卡分析以下问题。`,
          input: query,
          priority: CogPriority.NORMAL,
          deadline: Date.now() + 60000,
          bridgeId,
        });
        return { bridgeId, result };
      })
    );
    return results;
  }

  /** 反事实推演 */
  async counterfactual(hypothesis: string): Promise<AssistantMessage> {
    const kernel = this.getIdleKernel('counterfactual');
    return this.executeOnKernel(kernel, {
      id: `cf-${++this.taskCounter}`,
      type: 'counterfactual',
      description: '进行反事实推演：假设条件改变，推演可能的结果。',
      input: hypothesis,
      priority: CogPriority.NORMAL,
      deadline: Date.now() + 60000,
    });
  }

  /** 知识检索+总结 */
  async retrieveAndSummarize(query: string): Promise<AssistantMessage> {
    const kernel = this.getIdleKernel('retrieval');
    return this.executeOnKernel(kernel, {
      id: `retrieve-${++this.taskCounter}`,
      type: 'retrieval',
      description: '检索相关知识并生成摘要。',
      input: query,
      priority: CogPriority.NORMAL,
      deadline: Date.now() + 30000,
    });
  }

  /** 守护任务 */
  async daemon(description: string, input: string): Promise<AssistantMessage | null> {
    const kernel = this.getIdleKernel('daemon');
    if (!kernel) return null;
    return this.executeOnKernel(kernel, {
      id: `daemon-${++this.taskCounter}`,
      type: 'daemon',
      description,
      input,
      priority: CogPriority.IDLE,
      deadline: Date.now() + 120000,
    });
  }

  /**
   * 一键深度分析：主对话 + 多桥分析 + 反事实 + 综合
   * 这是单用户场景的核心价值——一个请求触发全内核并行
   */
  async deepAnalyze(query: string): Promise<{
    mainReply: AssistantMessage;
    bridgeAnalyses: Array<{ bridgeId: string; result: AssistantMessage }>;
    counterfactualResult: AssistantMessage;
    synthesis: string;
  }> {
    // 第一步：主 Pi 先做初步分析和桥路由
    const mainKernel = this.getKernel('main');
    const mainAnalysis = await mainKernel.agent.os.injectCognition(
      [{ role: 'user', content: query }], ''
    );

    // 第二步：并行启动多桥分析 + 反事实推演
    const activeBridges = mainAnalysis.bridge
      ? [mainAnalysis.bridge.id]
      : ['Q02', 'Q04', 'Q08'];

    const [bridgeAnalyses, counterfactualResult] = await Promise.all([
      this.analyzeFromBridges(query, activeBridges.slice(0, this.config.bridgeKernels)),
      this.counterfactual(`如果${query}的假设条件发生根本变化，结果会如何？`),
    ]);

    // 第三步：主 Pi 回复用户（基于初步分析）
    const mainReply = await this.prompt(query);

    // 第四步：综合多桥分析结果
    const synthesis = [
      `📍 主分析桥: ${mainAnalysis.bridge?.icon} ${mainAnalysis.bridge?.name}`,
      `📊 多桥分析: ${bridgeAnalyses.map(b => b.bridgeId).join(', ')}`,
      `🔄 反事实推演: 已完成`,
      `📋 摘要: ${mainAnalysis.summary}`,
    ].join('\n');

    return { mainReply, bridgeAnalyses, counterfactualResult, synthesis };
  }

  // ═══════════════════════════════════════════════════════════
  // 内部
  // ═══════════════════════════════════════════════════════════

  private async executeOnKernel(kernel: PiKernel, task: CognitiveTask): Promise<AssistantMessage> {
    kernel.activeTaskCount++;
    kernel.totalTaskCount++;

    // 注册到调度器
    const cogTask = this.scheduler.createTask({
      name: task.id,
      type: 'think',
      priority: task.priority,
      deadline: task.deadline,
      context: { input: task.input },
      instanceId: kernel.id,
      schedPolicy: {
        type: 'consensus-deadline',
        deadline: task.deadline,
        finishTime: 0,
        period: 0,
      },
    });
    this.scheduler.enqueueTask(cogTask, kernel.id);

    try {
      // 真正的 agent-loop：LLM 调用 + 工具执行 + 认知注入
      const result = await kernel.agent.harness.prompt(
        task.description
          ? `${task.description}\n\n${task.input}`
          : task.input
      );

      task.onComplete?.(result);

      // 获取认知分析结果
      const analysis = kernel.agent.getLatestAnalysis();
      if (analysis) {
        task.onAnalysis?.(analysis);
      }

      return result;
    } finally {
      kernel.activeTaskCount--;
    }
  }

  private getKernel(role: KernelRole): PiKernel {
    const kernel = this.getIdleKernel(role);
    if (!kernel) throw new Error(`No ${role} kernel available`);
    return kernel;
  }

  private getIdleKernel(role: KernelRole): PiKernel | undefined {
    const candidates = [...this.kernels.values()]
      .filter(k => k.role === role)
      .sort((a, b) => a.activeTaskCount - b.activeTaskCount);

    return candidates[0];
  }

  // ═══════════════════════════════════════════════════════════
  // 查询
  // ═══════════════════════════════════════════════════════════

  getKernelStatus(): Array<{ id: string; role: string; active: number; total: number; priority: string }> {
    return [...this.kernels.values()].map(k => ({
      id: k.id,
      role: k.role,
      active: k.activeTaskCount,
      total: k.totalTaskCount,
      priority: CogPriority[k.priority] ?? 'UNKNOWN',
    }));
  }

  getSchedulerStats() {
    return this.scheduler.getStats();
  }

  stop(): void {
    for (const k of this.kernels.values()) k.agent.stop();
    this.kernels.clear();
    this.scheduler.stopGC();
    this.scheduler.reset();
  }
}

// ═══════════════════════════════════════════════════════════════
// 工厂
// ═══════════════════════════════════════════════════════════════

export async function createOrchestrator(
  options: KunlunAgentOptions,
  config?: KernelPoolConfig,
): Promise<MultiKernelOrchestrator> {
  const orch = new MultiKernelOrchestrator(options, config);
  await orch.start();
  return orch;
}
