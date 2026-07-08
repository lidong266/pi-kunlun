/**
 * CogMetaSynthesis 类型定义 — 大成智慧学综合集成
 */

import type { Trit } from '@kunlun/ternary';

export interface SynthesisParticipant {
  id: string;
  name: string;
  type: 'pi-agent' | 'llm' | 'tool' | 'human';
  /**
   * 大成智慧学双轴：预置的定性立场与推理（可选）。
   * 量智子代理（逻辑推演）与性智子代理（整体综合）可先给出有立场的意见，
   * 综合集成引擎优先采用，缺省则回退到 T_UNKNOWN 占位。
   */
  stance?: Trit;
  reasoning?: string;
  confidence?: number;
}

export interface QualitativeResult {
  participantId: string;
  stance: Trit;
  reasoning: string;
  confidence: number; // 0-1
}

export interface QuantitativeResult {
  proposition: string;
  confidence: number;
  evidenceStrength: number;
  consensusRatio: number;
}

export interface UnifiedConclusion {
  stance: Trit;
  confidence: number;
  supportingIds: string[];
}

export interface SynthesisResult {
  consensus: UnifiedConclusion;
  disagreements: QualitativeResult[];
  overallConfidence: number;
}
