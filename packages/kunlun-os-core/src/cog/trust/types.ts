/**
 * CogTrust 类型定义 — 认知信任与价值对齐
 *
 * 参考设计文档：信任评估与价值对齐机制
 */

// ═══════════════════════════════════════════════════════════════
// 信任级别
// ═══════════════════════════════════════════════════════════════

/**
 * 信任级别 — 从高到低
 */
export type TrustLevel = 'system' | 'high' | 'medium' | 'low' | 'untrusted';

// ═══════════════════════════════════════════════════════════════
// 信任证据
// ═══════════════════════════════════════════════════════════════

/**
 * 信任证据类型
 */
export type TrustEvidenceType =
  | 'reputation-history'
  | 'value-alignment-test'
  | 'third-party-endorsement'
  | 'direct-observation';

/**
 * TrustEvidence — 单条信任证据
 */
export interface TrustEvidence {
  /** 证据类型 */
  type: TrustEvidenceType;
  /** 评分 0-1 */
  score: number;
  /** 时间戳 */
  timestamp: number;
  /** 来源标识 */
  source: string;
}

// ═══════════════════════════════════════════════════════════════
// 价值对齐
// ═══════════════════════════════════════════════════════════════

/**
 * ValueAlignment — 价值对齐配置
 *
 * 定义节点所遵循的价值观及各认知阶段的信任阈值
 */
export interface ValueAlignment {
  /** 价值观列表 */
  values: string[];
  /** 各阶段信任阈值（0-1） */
  thresholds: {
    perceive: number;
    think: number;
    act: number;
    govern: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// 任务类型（用于授权）
// ═══════════════════════════════════════════════════════════════

/**
 * 任务类型 — 对应价值对齐阈值维度
 */
export type TaskType = 'perceive' | 'think' | 'act' | 'govern';
