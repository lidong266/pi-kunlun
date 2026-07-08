/**
 * CogMemory 类型定义 — Token与注意力预算管理
 *
 * 参考设计文档：Token预算、上下文窗口与注意力调度
 */

// ═══════════════════════════════════════════════════════════════
// Token 预算
// ═══════════════════════════════════════════════════════════════

/**
 * TokenBudget — Token预算管理接口
 *
 * 管理一个池子的token分配、释放和水位线
 */
export interface TokenBudget {
  /** 总token数 */
  totalTokens: number;
  /** 已使用token数 */
  usedTokens: number;
  /** 水位线（超过则触发压缩或拒绝） */
  watermark: number;
  /** 分配token给任务 */
  allocate(taskId: string, tokens: number): boolean;
  /** 释放任务的token */
  release(taskId: string): void;
  /** 获取任务使用的token数 */
  getUsage(taskId: string): number;
  /** 获取可用token数 */
  getAvailable(): number;
}

// ═══════════════════════════════════════════════════════════════
// 上下文窗口
// ═══════════════════════════════════════════════════════════════

/**
 * ContextWindowSections — 上下文窗口各部分token占比
 */
export interface ContextWindowSections {
  system: number;
  input: number;
  history: number;
  output: number;
}

/**
 * ContextWindow — 上下文窗口
 *
 * 描述单个任务的上下文token分配
 */
export interface ContextWindow {
  /** 任务ID */
  taskId: string;
  /** 各部分占比 */
  sections: ContextWindowSections;
  /** 总token数 */
  total: number;
  /** 已使用token数 */
  used: number;
  /** 压缩上下文，返回压缩后节省的token数 */
  compress(): number;
  /** 按重要性重排上下文 */
  prioritize(importance: Map<string, number>): void;
}

// ═══════════════════════════════════════════════════════════════
// 注意力调度
// ═══════════════════════════════════════════════════════════════

/**
 * AttentionSchedule — 注意力调度计划
 */
export interface AttentionSchedule {
  /** 任务ID */
  taskId: string;
  /** 注意力权重 0-1 */
  attentionWeight: number;
  /** 专注持续时间（毫秒） */
  focusDuration: number;
  /** 是否可中断 */
  interruptible: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 池类型
// ═══════════════════════════════════════════════════════════════

/**
 * PoolType — Token池类型
 */
export type PoolType = 'llm' | 'cache' | 'knowledge';

// ═══════════════════════════════════════════════════════════════
// 矛盾级别（用于注意力调度）
// ═══════════════════════════════════════════════════════════════

/**
 * ContradictionLevel — 矛盾级别
 */
export type ContradictionLevel = 'none' | 'low' | 'medium' | 'high';

// ═══════════════════════════════════════════════════════════════
// 任务接口（用于调度）
// ═══════════════════════════════════════════════════════════════

/**
 * SchedulableTask — 可调度任务
 */
export interface SchedulableTask {
  /** 任务ID */
  taskId: string;
  /** 任务优先级 0-1 */
  priority: number;
  /** 估计所需token数 */
  estimatedTokens: number;
  /** 截止时间戳（毫秒），可选 */
  deadline?: number;
}
