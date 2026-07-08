/**
 * CogKAL 类型定义 — 认知内核抽象层核心类型系统
 *
 * 参考设计文档第7章：多认知核心调度器
 * 从 HarmonyOS LiteOS-A 借鉴：g_schedRunqueue / LosTaskCB / SchedOps / SMP IPI
 *
 * 关键区别：调度的是"认知任务"而非"CPU线程"
 */

import type { Trit, Tryte } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════════
// 认知任务状态（类比 LosTaskCB 状态机，但为认知任务定制）
// ═══════════════════════════════════════════════════════════════

export enum CogTaskStatus {
  INIT    = 0x0001,
  READY   = 0x0002,
  RUNNING = 0x0004,
  BLOCKED = 0x0008,
  EXIT    = 0x0010,
  TIMEOUT = 0x0020,
  ERROR   = 0x0040,
}

// ═══════════════════════════════════════════════════════════════
// 认知任务类型（七层认知流映射）
// ═══════════════════════════════════════════════════════════════

export type CogTaskType =
  | 'perceive'   // 感知
  | 'think'      // 思考
  | 'express'    // 表达
  | 'memorize'   // 记忆
  | 'govern'     // 治理
  | 'evolve'     // 进化
  | 'act';       // 行动

// ═══════════════════════════════════════════════════════════════
// 认知优先级（类比 HPF 32级位图）
// ═══════════════════════════════════════════════════════════════

export enum CogPriority {
  IDLE    = 0,
  LOW     = 8,
  NORMAL  = 16,
  HIGH    = 24,
  CRITICAL = 31,
}

export function priorityFromLevel(level: number, urgency: number): CogPriority {
  if (level > 0.8 && urgency > 0.8) return CogPriority.CRITICAL;
  if (level > 0.5 || urgency > 0.5) return CogPriority.HIGH;
  if (urgency > 0.3) return CogPriority.NORMAL;
  if (urgency > 0.1) return CogPriority.LOW;
  return CogPriority.IDLE;
}

// ═══════════════════════════════════════════════════════════════
// 调度策略（多态：类比 SchedOps 虚函数表）
// ═══════════════════════════════════════════════════════════════

export type CogSchedPolicy =
  | { type: 'contradiction-priority'; priority: CogPriority; basePrio: CogPriority; timeSlice: number }
  | { type: 'consensus-deadline'; deadline: number; finishTime: number; period: number }
  | { type: 'spiral-iteration'; cycleCount: number; convergenceScore: number; deltaConvergence: number }
  | { type: 'idle' };

// ═══════════════════════════════════════════════════════════════
// 认知亲和性（类比 CPU Affinity / cpuAffiMask）
// ═══════════════════════════════════════════════════════════════

export type CogKernelType = 'pi-agent' | 'llm' | 'tool' | 'human';

export interface KernelAffinity {
  preferredKernel: CogKernelType;
  currentInstance: string;
  lastInstance: string;
  allowedInstances: string[];
}

// ═══════════════════════════════════════════════════════════════
// 认知任务控制块（类比 LosTaskCB）
// ═══════════════════════════════════════════════════════════════

export interface CogTaskContext {
  input: unknown;
  output?: unknown;
  error?: Error;
  executor: (ctx: CogTaskContext) => Promise<unknown>;
  args: unknown[];
}

export interface CogTaskCB {
  id: string;
  name: string;
  type: CogTaskType;
  status: CogTaskStatus;
  priority: CogPriority;
  startTime: number;
  totalRuntime: number;
  irqUsedTime: number;
  policy: CogSchedPolicy;
  kernelAffinity: KernelAffinity;
  context: CogTaskContext;
  signal: number;
  tokenBudget: number;
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════
// 认知运行队列（类比 g_schedRunqueue[CORE_NUM]）
// ═══════════════════════════════════════════════════════════════

export interface CogRunqueue {
  instanceId: string;
  /** 矛盾优先级队列（HPF 32级位图） */
  contradictionQueue: Map<CogPriority, CogTaskCB[]>;
  contradictionBitmap: number;
  /** 共识截止时间队列（EDF 排序） */
  consensusQueue: CogTaskCB[];
  /** 螺旋迭代队列 */
  spiralQueue: CogTaskCB[];
  /** 超时管理 */
  ttlQueue: CogTaskCB[];
  /** 空闲任务 */
  idleTask: CogTaskCB | null;
  /** 当前运行任务 */
  currentTask: CogTaskCB | null;
  lockCount: number;
  schedFlag: number;
}

// ═══════════════════════════════════════════════════════════════
// 认知信号（类比 Unix Signal，但为认知任务定制）
// ═══════════════════════════════════════════════════════════════

export enum CogSignal {
  NONE = 0,
  KILL = 1 << 0,
  HALT = 1 << 1,
  WAKE = 1 << 2,
  SYNC  = 1 << 3,
  PRIO  = 1 << 4,
}

// ═══════════════════════════════════════════════════════════════
// 认知 IPI 类型（类比 SMP 核间中断）
// ═══════════════════════════════════════════════════════════════

export enum CogIPIType {
  WAKEUP    = 0,
  SCHEDULE  = 1,
  HALT      = 2,
  FUNC_CALL = 3,
}

export interface CogIPIMessage {
  type: 'ipi';
  ipiType: CogIPIType;
  from: string;
  callFunc?: { func: Function; args: unknown };
}

// ═══════════════════════════════════════════════════════════════
// 认知 IPC 消息
// ═══════════════════════════════════════════════════════════════

export interface CogMessage {
  id: string;
  type: string;
  payload: unknown;
  from: string;
  to: string;
  timestamp: number;
  ttl: number;
  inReplyTo?: string;
}

// ═══════════════════════════════════════════════════════════════
// 调度统计
// ═══════════════════════════════════════════════════════════════

export interface CogSchedStats {
  totalTasks: number;
  completedTasks: number;
  timeoutTasks: number;
  errorTasks: number;
  avgRuntime: number;
  maxRuntime: number;
  instanceLoads: Record<string, number>;
}
