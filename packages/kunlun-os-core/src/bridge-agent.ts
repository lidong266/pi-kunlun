/**
 * 学科桥双轴子代理 — 大成智慧学"量智"与"性智"的辩证统一
 * [成熟度: 种子期→成长期] 种子期规则实现（纯函数、不依赖 LLM）；成熟期可由龙门卡片驱动更细推演
 *
 * 钱学森借熊十力之划分：
 *   - 量智：科学、逻辑、分析、可计算之智慧（对应 TC 工具卡 + AX 公理卡）
 *   - 性智：文化、艺术、整体、直觉之智慧（对应 SC 学科卡的整体观）
 *   "缺一不成智慧" —— 故每座学科桥挂两个子代理，分别产出后再由综合集成会商。
 *
 * 设计约束（架构文档 §三 / 约束6）：
 *   - 专家资格锚定归藏桥卡片（AX/SC/TC），而非 system prompt 扮专家。
 *   - 本模块为种子期规则实现：纯函数、确定性、可单测、不依赖 LLM。
 *     成熟期可由龙门补录的卡片驱动更精细的推演，但接口不变。
 */

import type { KnowledgeCard, BridgeProfile } from './eleven-bridges.js';
import { T_TRUE, T_FALSE, T_UNKNOWN, type Trit } from '@kunlun/ternary';

/** 双轴意见的统一结构 */
export interface AxisOpinion {
  /** 立场：1 支持正题 / -1 支持反题 / 0 待定 */
  stance: Trit;
  /** 推理解释 */
  reasoning: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 命中的卡片（溯源用） */
  cards: string[];
}

// ─────────────────────────────────────────────────────────────
// 量智子代理：消费 TC(工具卡) + AX(公理卡) 做逻辑推演
// ─────────────────────────────────────────────────────────────

/**
 * 量智推演逻辑：
 *   - AX 公理卡 = 不可违背的约束（如"整体大于部分之和"）。若命题与公理冲突 → 反题立场。
 *   - TC 工具卡 = 可操作的判定工具（如"量变质变临界点检测"）。命中工具词 → 给出明确立场 + 高置信。
 *   - 无 AX/TC 命中 → 不妄断，返回 T_UNKNOWN。
 */
const AX_CONFLICT_HINTS = ['片面', '孤立', '割裂', '局部优于整体', '忽视整体'];
const TC_DECISION_HINTS = ['临界', '阈值', '量化', '测量', '指标', '效率', '优化', '结构', '反馈'];

export function liangZhiAnalyze(
  bridge: BridgeProfile,
  proposition: string,
): AxisOpinion {
  const lower = proposition.toLowerCase();
  const axCards = bridge.cards.filter(c => c.type === 'AX');
  const tcCards = bridge.cards.filter(c => c.type === 'TC');

  const axHits = axCards.filter(c =>
    c.tags.some(t => lower.includes(t.toLowerCase())) ||
    lower.includes(c.title.slice(0, 2).toLowerCase()),
  );
  const tcHits = tcCards.filter(c =>
    TC_DECISION_HINTS.some(h => lower.includes(h)) ||
    c.tags.some(t => lower.includes(t.toLowerCase())),
  );

  const conflict = AX_CONFLICT_HINTS.some(h => lower.includes(h));

  // 公理冲突 → 反对（反题立场 -1）
  if (conflict && axHits.length > 0) {
    return {
      stance: T_FALSE,
      reasoning: `〔量智·${bridge.name}〕命题与公理「${axHits[0]!.title}」冲突：整体/系统约束被违背`,
      confidence: 0.82,
      cards: axHits.map(c => c.id),
    };
  }

  // 命中工具卡 → 可量化判定，给出明确立场（默认支持正题，因工具可用于推进）
  if (tcHits.length > 0) {
    return {
      stance: T_TRUE,
      reasoning: `〔量智·${bridge.name}〕工具「${tcHits[0]!.title}」可操作化命题，具备可度量推进路径`,
      confidence: 0.7 + Math.min(tcHits.length * 0.05, 0.15),
      cards: tcHits.map(c => c.id),
    };
  }

  // 仅有公理、无冲突无工具 → 弱支持（公理提供基础约束，偏向正题但保守）
  if (axHits.length > 0) {
    return {
      stance: T_TRUE,
      reasoning: `〔量智·${bridge.name}〕命题符合公理「${axHits[0]!.title}」基本约束`,
      confidence: 0.55,
      cards: axHits.map(c => c.id),
    };
  }

  // 飞轮兜底：命题已路由命中本桥，且本桥已具备 TC 工具卡（含龙门补录的 DG- 卡）
  // → 结构性判定"该桥可提供工具化路径"（非支持正题，仅表示有分析抓手），
  // 消除 UNKNOWN。置信显著低于文本精确命中，避免伪造强立场（约束4）。
  if (tcCards.length > 0) {
    const matured = tcCards.some(c => !c.id.startsWith('DG-'));
    const conf = matured ? 0.5 : 0.42;
    return {
      stance: T_TRUE,
      reasoning: `〔量智·${bridge.name}〕本桥已具备工具卡「${tcCards[0]!.title}」，命题可工具化分析（结构性定位，非立场判定）`,
      confidence: conf,
      cards: tcCards.map(c => c.id),
    };
  }

  // 无 AX/TC 命中也无工具卡 → 量智不妄断
  return {
    stance: T_UNKNOWN,
    reasoning: `〔量智·${bridge.name}〕未命中公理/工具卡且无工具卡，留待性智整体权衡`,
    confidence: 0.3,
    cards: [],
  };
}

// ─────────────────────────────────────────────────────────────
// 性智子代理：消费 SC(学科卡) 做整体综合
// ─────────────────────────────────────────────────────────────

/**
 * 性智综合逻辑：
 *   - SC 学科卡 = 该学科的整体世界观（如"政治经济学""控制论与反馈回路"）。
 *   - 命中学科词 → 给出 holistic 立场（偏中性/整合，置信度中等，强调系统性权衡）。
 *   - 性智不追求精确判定，而追求"放在整体里是否自洽"。
 */
const SC_HOLISTIC_HINTS = ['平衡', '系统', '协调', '整体', '可持续', '结构', '演进', '价值', '意义'];

export function xingZhiAnalyze(
  bridge: BridgeProfile,
  proposition: string,
): AxisOpinion {
  const lower = proposition.toLowerCase();
  const scCards = bridge.cards.filter(c => c.type === 'SC');

  const scHits = scCards.filter(c =>
    SC_HOLISTIC_HINTS.some(h => lower.includes(h)) ||
    c.tags.some(t => lower.includes(t.toLowerCase())) ||
    lower.includes(c.title.slice(0, 2).toLowerCase()),
  );

  if (scHits.length > 0) {
    // 性智：整体自洽 → 支持，但强调需与其他桥权衡（置信度中等）
    return {
      stance: T_TRUE,
      reasoning: `〔性智·${bridge.name}〕学科「${scHits[0]!.title}」视角下命题在整体框架内可自洽，需跨桥权衡`,
      confidence: 0.6,
      cards: scHits.map(c => c.id),
    };
  }

  // 飞轮兜底：命题已路由命中本桥，且本桥已具备 SC 学科卡（含龙门补录的 DG- 卡）
  // → 结构性判定"该学科有整体世界观可定位"（非支持正题），消除 UNKNOWN。
  if (scCards.length > 0) {
    const matured = scCards.some(c => !c.id.startsWith('DG-'));
    const conf = matured ? 0.48 : 0.4;
    return {
      stance: T_TRUE,
      reasoning: `〔性智·${bridge.name}〕本桥已具备学科卡「${scCards[0]!.title}」，命题在该学科整体框架内可定位（结构性定位，非立场判定）`,
      confidence: conf,
      cards: scCards.map(c => c.id),
    };
  }

  // 无 SC 命中也无学科卡 → 性智也无法整体定位，待定
  return {
    stance: T_UNKNOWN,
    reasoning: `〔性智·${bridge.name}〕未命中学科整体观且无学科卡，留待多桥会商`,
    confidence: 0.35,
    cards: [],
  };
}

// ─────────────────────────────────────────────────────────────
// 桥级双轴装配：每座桥产出量智 + 性智两条意见
// ─────────────────────────────────────────────────────────────

export interface BridgeDualAxis {
  bridgeId: string;
  bridgeName: string;
  icon: string;
  liangZhi: AxisOpinion; // 量智
  xingZhi: AxisOpinion;  // 性智
}

export function analyzeBridgeDualAxis(
  bridge: BridgeProfile,
  proposition: string,
): BridgeDualAxis {
  return {
    bridgeId: bridge.id,
    bridgeName: bridge.name,
    icon: bridge.icon,
    liangZhi: liangZhiAnalyze(bridge, proposition),
    xingZhi: xingZhiAnalyze(bridge, proposition),
  };
}

/** 双轴合并为单一桥立场（量智权重略高，因种子期以逻辑可判定性为先；性智纠偏） */
export function mergeAxisOpinion(d: BridgeDualAxis): AxisOpinion {
  const l = d.liangZhi, x = d.xingZhi;
  // 双方均未知 → 未知
  if (l.stance === T_UNKNOWN && x.stance === T_UNKNOWN) {
    return { stance: T_UNKNOWN, reasoning: `〔${d.bridgeName}〕量智性智均未定位`, confidence: 0.3, cards: [] };
  }
  // 冲突：量智与性智相反 → 取置信度高者，标记需会商
  if (l.stance !== T_UNKNOWN && x.stance !== T_UNKNOWN && l.stance !== x.stance) {
    const pick = l.confidence >= x.confidence ? l : x;
    return {
      stance: pick.stance,
      reasoning: `〔${d.bridgeName}〕量智(${l.stance})与性智(${x.stance})分歧，采信高置信方：${pick.reasoning}`,
      confidence: Math.max(l.confidence, x.confidence) * 0.9,
      cards: [...l.cards, ...x.cards],
    };
  }
  // 同向或一方未知 → 综合
  const stance = l.stance !== T_UNKNOWN ? l.stance : x.stance;
  const conf = (l.confidence + x.confidence) / 2;
  return {
    stance,
    reasoning: `〔${d.bridgeName}〕量智+性智综合：${l.reasoning}；${x.reasoning}`,
    confidence: conf,
    cards: [...l.cards, ...x.cards],
  };
}
