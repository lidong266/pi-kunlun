/**
 * — Token与注意力预算管理
 *
 * 统一Token池管理、上下文窗口压缩和注意力调度
 */

// ─── 类型 ───
export type {
  TokenBudget,
  ContextWindowSections,
  ContextWindow,
  AttentionSchedule,
  PoolType,
  ContradictionLevel,
  SchedulableTask,
} from './types';

// ─── Token管理器 ───
export { TokenManager } from './token-manager';

// ─── 注意力调度器 ───
export { AttentionScheduler } from './attention-scheduler';

// ─── 辅助函数 ───

import { TokenManager } from './token-manager';
import { AttentionScheduler } from './attention-scheduler';

/**
 * 创建Token管理器
 */
export function createTokenManager(): TokenManager {
  return new TokenManager();
}

/**
 * 创建注意力调度器
 */
export function createAttentionScheduler(): AttentionScheduler {
  return new AttentionScheduler();
}
