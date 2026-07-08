/**
 * TokenManager — Token预算管理器
 *
 * 管理三个Token池（llm/cache/knowledge）的分配、释放、水位线和上下文窗口
 * 参考设计文档
 */

import type {
  TokenBudget,
  ContextWindow,
  ContextWindowSections,
  PoolType,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 池默认容量
// ═══════════════════════════════════════════════════════════════

const POOL_DEFAULTS: Record<PoolType, number> = {
  llm: 128000,
  cache: 50000,
  knowledge: 100000,
};

const POOL_WATERMARK_RATIO = 0.8;

// ═══════════════════════════════════════════════════════════════
// TokenPoolImpl — TokenBudget实现
// ═══════════════════════════════════════════════════════════════

class TokenPoolImpl implements TokenBudget {
  totalTokens: number;
  usedTokens: number;
  watermark: number;
  private allocations: Map<string, number> = new Map();

  constructor(totalTokens: number, watermark?: number) {
    this.totalTokens = totalTokens;
    this.watermark = watermark ?? Math.floor(totalTokens * POOL_WATERMARK_RATIO);
    this.usedTokens = 0;
  }

  allocate(taskId: string, tokens: number): boolean {
    if (this.usedTokens + tokens > this.totalTokens) {
      return false;
    }
    const current = this.allocations.get(taskId) ?? 0;
    this.allocations.set(taskId, current + tokens);
    this.usedTokens += tokens;
    return true;
  }

  release(taskId: string): void {
    const allocated = this.allocations.get(taskId);
    if (allocated !== undefined) {
      this.usedTokens -= allocated;
      this.allocations.delete(taskId);
    }
  }

  getUsage(taskId: string): number {
    return this.allocations.get(taskId) ?? 0;
  }

  getAvailable(): number {
    return this.totalTokens - this.usedTokens;
  }
}

// ═══════════════════════════════════════════════════════════════
// ContextWindowImpl — ContextWindow实现
// ═══════════════════════════════════════════════════════════════

class ContextWindowImpl implements ContextWindow {
  taskId: string;
  sections: ContextWindowSections;
  total: number;
  used: number;

  constructor(taskId: string, total: number, sections?: Partial<ContextWindowSections>) {
    this.taskId = taskId;
    this.total = total;
    this.sections = {
      system: sections?.system ?? 0.1,
      input: sections?.input ?? 0.3,
      history: sections?.history ?? 0.4,
      output: sections?.output ?? 0.2,
    };
    this.used = 0;
  }

  compress(): number {
    // 压缩history部分为原来的50%
    const historyTokens = Math.floor(this.total * this.sections.history);
    const compressed = Math.floor(historyTokens * 0.5);
    const saved = historyTokens - compressed;
    this.sections.history = compressed / this.total;
    return saved;
  }

  prioritize(importance: Map<string, number>): void {
    // 根据重要性重排各部分占比
    const entries = Array.from(importance.entries());
    const sum = entries.reduce((s, [, v]) => s + v, 0);
    if (sum <= 0) {
      return;
    }
    for (const [key, value] of entries) {
      if (key in this.sections) {
        const k = key as keyof ContextWindowSections;
        this.sections[k] = value / sum;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TokenManager
// ═══════════════════════════════════════════════════════════════

export class TokenManager {
  private pools: Map<PoolType, TokenPoolImpl> = new Map();
  private contextWindows: Map<string, ContextWindowImpl> = new Map();

  constructor() {
    this.pools.set('llm', new TokenPoolImpl(POOL_DEFAULTS.llm));
    this.pools.set('cache', new TokenPoolImpl(POOL_DEFAULTS.cache));
    this.pools.set('knowledge', new TokenPoolImpl(POOL_DEFAULTS.knowledge));
  }

  /**
   * 分配token给任务（从llm池分配）
   */
  allocate(task: { taskId: string; estimatedTokens?: number }, tokens: number): boolean {
    const llmPool = this.pools.get('llm')!;
    return llmPool.allocate(task.taskId, tokens);
  }

  /**
   * 释放任务的token
   */
  release(taskId: string): void {
    for (const pool of this.pools.values()) {
      pool.release(taskId);
    }
    this.contextWindows.delete(taskId);
  }

  /**
   * 获取或创建任务的上下文窗口
   */
  getContextWindow(task: { taskId: string; estimatedTokens?: number }): ContextWindow {
    const existing = this.contextWindows.get(task.taskId);
    if (existing) {
      return existing;
    }
    const total = task.estimatedTokens ?? this.pools.get('llm')!.getUsage(task.taskId);
    const cw = new ContextWindowImpl(task.taskId, total);
    this.contextWindows.set(task.taskId, cw);
    return cw;
  }

  /**
   * 获取指定池的使用情况
   */
  getPoolUsage(poolType: PoolType): { total: number; used: number; available: number } {
    const pool = this.pools.get(poolType);
    if (!pool) {
      return { total: 0, used: 0, available: 0 };
    }
    return {
      total: pool.totalTokens,
      used: pool.usedTokens,
      available: pool.getAvailable(),
    };
  }

  /**
   * 设置池的水位线
   */
  setWatermark(poolType: PoolType, watermark: number): void {
    const pool = this.pools.get(poolType);
    if (pool) {
      pool.watermark = watermark;
    }
  }
}
