/**
 * — 认知信任与价值对齐
 *
 * 基于证据的信任评估、价值对齐授权和信任传递
 */

// ─── 类型 ───
export type {
  TrustLevel,
  TrustEvidenceType,
  TrustEvidence,
  ValueAlignment,
  TaskType,
} from './types';

// ─── 信任管理器 ───
export { TrustManager } from './trust-manager';

// ─── 辅助函数 ───

import { TrustManager } from './trust-manager';
import type { ValueAlignment } from './types';

/**
 * 默认价值对齐配置
 */
export function defaultValueAlignment(): ValueAlignment {
  return {
    values: ['safety', 'honesty', 'helpfulness'],
    thresholds: {
      perceive: 0.3,
      think: 0.5,
      act: 0.7,
      govern: 0.9,
    },
  };
}

/**
 * 创建信任管理器
 */
export function createTrustManager(): TrustManager {
  return new TrustManager();
}
