/**
 * MetaSynthesisWorkshop — 大成智慧学研讨工作坊
 *
 * 模拟钱学森大成智慧学的研讨厅方法论：
 * 讨论 → 收集意见 → 反驳 → 收敛
 */

import type { Trit } from '@kunlun/ternary';
import { T_UNKNOWN } from '@kunlun/ternary';
import type {
  SynthesisParticipant,
  QualitativeResult,
  SynthesisResult,
} from './types.js';
import { MetaSynthesisEngine } from './engine.js';

export class MetaSynthesisWorkshop {
  private engine: MetaSynthesisEngine;
  private participants: SynthesisParticipant[];
  private opinions: QualitativeResult[];
  private rebuttals: QualitativeResult[];
  private proposition: string;

  constructor(participants: SynthesisParticipant[]) {
    this.engine = new MetaSynthesisEngine();
    this.participants = participants;
    this.opinions = [];
    this.rebuttals = [];
    this.proposition = '';
  }

  /** 研讨：提出命题开始讨论 */
  discuss(proposition: string): QualitativeResult[] {
    this.proposition = proposition;
    this.opinions = this.engine.qualitativeJudgment(proposition, this.participants);
    return this.opinions;
  }

  /** 收集意见 */
  collectOpinions(): QualitativeResult[] {
    return [...this.opinions];
  }

  /** 反驳：针对意见进行反驳 */
  rebuttal(): QualitativeResult[] {
    // 反驳方取对立立场
    this.rebuttals = this.opinions.map(o => ({
      participantId: o.participantId,
      stance: (o.stance * -1) as Trit,
      reasoning: `Rebuttal to: ${o.reasoning}`,
      confidence: o.confidence * 0.8,
    }));
    return this.rebuttals;
  }

  /** 收敛：综合意见与反驳，形成最终结论 */
  async converge(): Promise<SynthesisResult> {
    // 合并原始意见和反驳意见
    const allViews = [...this.opinions, ...this.rebuttals];
    const quantitative = this.engine.quantitativeAnalysis(allViews);
    return this.engine.integrate(allViews, quantitative);
  }

  /** 获取参与者 */
  getParticipants(): SynthesisParticipant[] {
    return [...this.participants];
  }

  /** 获取当前命题 */
  getProposition(): string {
    return this.proposition;
  }

  /** 重置研讨 */
  reset(): void {
    this.opinions = [];
    this.rebuttals = [];
    this.proposition = '';
  }
}
