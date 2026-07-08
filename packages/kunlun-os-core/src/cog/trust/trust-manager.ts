/**
 * TrustManager — 认知信任管理器
 *
 * 基于加权证据评分计算信任级别，并依据价值对齐阈值进行授权
 * 参考设计文档
 */

import type {
  TrustLevel,
  TrustEvidence,
  ValueAlignment,
  TaskType,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 证据类型权重
// ═══════════════════════════════════════════════════════════════

const EVIDENCE_WEIGHTS: Record<TrustEvidence['type'], number> = {
  'reputation-history': 0.3,
  'value-alignment-test': 0.35,
  'third-party-endorsement': 0.15,
  'direct-observation': 0.2,
};

// ═══════════════════════════════════════════════════════════════
// 信任级别阈值
// ═══════════════════════════════════════════════════════════════

const LEVEL_THRESHOLDS: Array<{ level: TrustLevel; min: number }> = [
  { level: 'system', min: 0.95 },
  { level: 'high', min: 0.8 },
  { level: 'medium', min: 0.6 },
  { level: 'low', min: 0.3 },
  { level: 'untrusted', min: 0 },
];

// ═══════════════════════════════════════════════════════════════
// 节点信任记录
// ═══════════════════════════════════════════════════════════════

interface NodeTrustRecord {
  score: number;
  evidence: TrustEvidence[];
}

// ═══════════════════════════════════════════════════════════════
// TrustManager
// ═══════════════════════════════════════════════════════════════

export class TrustManager {
  private records: Map<string, NodeTrustRecord> = new Map();

  /**
   * 评估节点信任级别 — 基于加权评分
   *
   * 将新证据与已有证据合并，按证据类型权重计算加权平均分
   */
  evaluate(nodeId: string, evidence: TrustEvidence[]): TrustLevel {
    const record = this.records.get(nodeId) ?? { score: 0, evidence: [] };
    const allEvidence = [...record.evidence, ...evidence];

    // 按证据类型分组加权
    const byType: Map<TrustEvidence['type'], TrustEvidence[]> = new Map();
    for (const ev of allEvidence) {
      const list = byType.get(ev.type) ?? [];
      list.push(ev);
      byType.set(ev.type, list);
    }

    let weightedSum = 0;
    let weightTotal = 0;
    for (const [type, evs] of byType) {
      const weight = EVIDENCE_WEIGHTS[type];
      const avg = evs.reduce((s, e) => s + e.score, 0) / evs.length;
      weightedSum += avg * weight;
      weightTotal += weight;
    }

    const score = weightTotal > 0 ? weightedSum / weightTotal : 0;

    this.records.set(nodeId, { score, evidence: allEvidence });
    return this.scoreToLevel(score);
  }

  /**
   * 授权 — 基于信任度和价值对齐阈值
   */
  authorize(taskType: TaskType, callerId: string, alignment: ValueAlignment): boolean {
    const score = this.getScore(callerId);
    const threshold = alignment.thresholds[taskType];
    return score >= threshold;
  }

  /**
   * 信任传递 — A信任B，B信任C，则A对C的信任级别降级
   *
   * 取两者中较低分数，并降一级
   */
  transitiveTrust(nodeA: string, nodeB: string): TrustLevel {
    const scoreA = this.getScore(nodeA);
    const scoreB = this.getScore(nodeB);
    const minScore = Math.min(scoreA, scoreB);
    // 传递信任衰减：乘以0.9
    const transitiveScore = minScore * 0.9;
    return this.scoreToLevel(transitiveScore);
  }

  /**
   * 获取节点信任评分
   */
  getScore(nodeId: string): number {
    return this.records.get(nodeId)?.score ?? 0;
  }

  /**
   * 获取节点信任级别
   */
  getTrustLevel(nodeId: string): TrustLevel {
    return this.scoreToLevel(this.getScore(nodeId));
  }

  /**
   * 获取节点所有证据
   */
  getEvidence(nodeId: string): TrustEvidence[] {
    return this.records.get(nodeId)?.evidence ?? [];
  }

  /**
   * 重置节点信任记录
   */
  reset(nodeId: string): void {
    this.records.delete(nodeId);
  }

  // ─── 内部工具 ───

  private scoreToLevel(score: number): TrustLevel {
    for (const { level, min } of LEVEL_THRESHOLDS) {
      if (score >= min) {
        return level;
      }
    }
    return 'untrusted';
  }
}
