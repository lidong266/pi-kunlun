/**
 * MetaSynthesisEngine — 大成智慧学综合集成引擎
 *
 * 定性判断 → 定量分析 → 综合集成 → 共识形成
 */

import type { Trit } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE, TritMath, clampToTrit } from '@kunlun/ternary';
import type {
  SynthesisParticipant,
  QualitativeResult,
  QuantitativeResult,
  SynthesisResult,
  UnifiedConclusion,
} from './types.js';

export class MetaSynthesisEngine {
  /** 综合集成全流程 */
  async synthesize(
    problem: string,
    participants: SynthesisParticipant[]
  ): Promise<SynthesisResult> {
    const qualitative = this.qualitativeJudgment(problem, participants);
    const quantitative = this.quantitativeAnalysis(qualitative);
    return this.integrate(qualitative, quantitative);
  }

  /** 定性判断：每个参与者给出立场（优先采用预置意见，缺省 T_UNKNOWN 占位） */
  qualitativeJudgment(
    problem: string,
    participants: SynthesisParticipant[]
  ): QualitativeResult[] {
    return participants.map(p => {
      // 大成智慧学双轴：若参与者自带立场（量智/性智子代理），优先采用
      if (p.stance !== undefined) {
        return {
          participantId: p.id,
          stance: p.stance,
          reasoning: p.reasoning ?? `分析「${problem}」— ${p.name}`,
          confidence: p.confidence ?? 0.6,
        };
      }
      return {
        participantId: p.id,
        stance: T_UNKNOWN as Trit,
        reasoning: `Analysis of "${problem}" by ${p.name} (${p.type})`,
        confidence: 0.5,
      };
    });
  }

  /** 定量分析：将定性结果转换为定量指标 */
  quantitativeAnalysis(qualitative: QualitativeResult[]): QuantitativeResult[] {
    const total = qualitative.length;
    const trueCount = qualitative.filter(q => q.stance === T_TRUE).length;
    const falseCount = qualitative.filter(q => q.stance === T_FALSE).length;
    const unknownCount = qualitative.filter(q => q.stance === T_UNKNOWN).length;

    const consensusRatio = total > 0 ? (trueCount + falseCount) / total : 0;
    const avgConfidence = total > 0
      ? qualitative.reduce((sum, q) => sum + q.confidence, 0) / total
      : 0;

    const dominantStance = clampToTrit(
      qualitative.reduce((sum, q) => sum + q.stance, 0) / (total || 1)
    );

    return qualitative.map(q => ({
      proposition: q.reasoning,
      confidence: q.confidence,
      evidenceStrength: q.confidence * (q.stance !== T_UNKNOWN ? 1 : 0.3),
      consensusRatio,
    }));
  }

  /** 综合集成：定性与定量相结合（大成智慧学"从定性到定量综合集成"） */
  integrate(
    qualitative: QualitativeResult[],
    quantitative: QuantitativeResult[]
  ): SynthesisResult {
    const total = qualitative.length;
    if (total === 0) {
      return {
        consensus: { stance: T_UNKNOWN, confidence: 0, supportingIds: [] },
        disagreements: [],
        overallConfidence: 0,
      };
    }

    // 从定性到定量：立场按置信度加权（非简单算术平均），UNKNOWN 不贡献立场
    const known = qualitative.filter(q => q.stance !== T_UNKNOWN);
    const stanceWeightedSum = known.reduce((sum, q) => sum + q.stance * q.confidence, 0);
    const weightTotal = known.reduce((sum, q) => sum + q.confidence, 0);
    const consensusStance = weightTotal > 0
      ? clampToTrit(Math.round(stanceWeightedSum / weightTotal))
      : T_UNKNOWN;

    // 共识确定度 = 有立场者占比 × 其平均置信（UNKNOWN 多则共识弱）
    const knownRatio = known.length / total;
    const avgConfidence = known.length > 0
      ? known.reduce((sum, q) => sum + q.confidence, 0) / known.length
      : 0.3;
    const overallConfidence = Math.round(knownRatio * avgConfidence * 100) / 100;

    const supportingIds = qualitative
      .filter(q => q.stance === consensusStance && q.stance !== T_UNKNOWN)
      .map(q => q.participantId);

    const disagreements = qualitative.filter(q => q.stance !== consensusStance);

    return {
      consensus: {
        stance: consensusStance,
        confidence: overallConfidence,
        supportingIds,
      },
      disagreements,
      overallConfidence,
    };
  }

  /** 检测分歧 */
  detectDisagreements(analyzed: QualitativeResult[]): QualitativeResult[] {
    const stanceSum = analyzed.reduce((sum, q) => sum + q.stance, 0);
    const total = analyzed.length;
    const dominant = clampToTrit(stanceSum / (total || 1));
    return analyzed.filter(q => q.stance !== dominant);
  }

  /** 形成共识（加权版，与 integrate 一致） */
  formConsensus(analyzed: QualitativeResult[]): UnifiedConclusion {
    const total = analyzed.length;
    if (total === 0) {
      return { stance: T_UNKNOWN, confidence: 0, supportingIds: [] };
    }
    const known = analyzed.filter(q => q.stance !== T_UNKNOWN);
    const wSum = known.reduce((s, q) => s + q.stance * q.confidence, 0);
    const wTot = known.reduce((s, q) => s + q.confidence, 0);
    const stance = wTot > 0 ? clampToTrit(Math.round(wSum / wTot)) : T_UNKNOWN;
    const knownRatio = known.length / total;
    const avgConf = known.length > 0 ? known.reduce((s, q) => s + q.confidence, 0) / known.length : 0.3;
    const confidence = Math.round(knownRatio * avgConf * 100) / 100;
    const supportingIds = analyzed.filter(q => q.stance === stance && q.stance !== T_UNKNOWN).map(q => q.participantId);
    return { stance, confidence, supportingIds };
  }
}
