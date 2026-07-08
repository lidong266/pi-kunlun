/**
 * 人以为主回路（Human-in-the-Loop）— 大成智慧学"人—机结合以人为主"
 * [成熟度: 种子期→成长期] 机器综合集成仅出草案；无人节点时诚实标 pending_human 不擅权
 *
 * 钱学森："最终还要靠人，靠人的智慧"（1990-10-16 报告）；
 * "我们要研究的是人-机结合的智能系统，不能把人排除在外"（1991-04-18 谈话）。
 * 综合集成研讨厅（§三）本质是"专家 + 知识系统 + 机器"的辩证统一，
 * 机器的综合集成只是"草案"，**最终裁决权在人**。
 *
 * 设计：
 *   - 机器综合集成产出 consensus 草案（含立场/置信/双轴依据）
 *   - 通过 HumanChannel 异步发送至人类节点，请求裁决
 *   - 裁决三态：confirm（确认）/ revise（人修订立场+注记）/ reject（否决）
 *   - 无人类节点（CLI/无头/离线）→ 降级为 pending_human：机器不擅权，诚实标记待确认
 *
 * 这不阻塞主流程：种子期无人在线时，共识草案照常产出并标注"待人工确认"，
 * 既不谎称权威，也不卡死自动化。
 */

import type { HumanChannel } from './cog/human/human-channel.js';

/** 机器共识草案（来自综合集成） */
export interface MachineConsensusDraft {
  stance: string;          // 如 "均势待定" / "正题主导"
  confidence: number;      // 0-1
  summary: string;         // 分析摘要
  bridges: string[];       // 参与会商的桥
  basis: string[];         // 双轴/矛盾依据摘要
}

/** 人的裁决 */
export type HumanVerdict = 'confirm' | 'revise' | 'reject';

export interface HumanReview {
  /** 机器草案（仅供参考，非最终） */
  draft: MachineConsensusDraft;
  /** 裁决状态 */
  status: 'pending_human' | 'confirmed' | 'revised' | 'rejected';
  /** 人最终立场（revise/reject 时区别于机器草案） */
  finalStance?: string;
  /** 人注记（为何修订/否决，溯源） */
  humanNote?: string;
  /** 裁决来源节点 */
  decidedBy?: string;
  /** 裁决时间 */
  decidedAt?: number;
}

export interface HumanReviewOptions {
  /** 人类节点 ID（默认取第一个已注册在线节点） */
  nodeId?: string;
  /** 等待裁决的超时（ms）；超时则保持 pending_human */
  timeoutMs?: number;
}

/**
 * 请求"人以为主"裁决。
 * 有 HumanChannel + 在线节点 → 发送草案并轮询裁决（受 timeoutMs 限制，超时仍 pending）。
 * 无人节点 → 立即返回 pending_human（机器不擅权）。
 */
export async function requestHumanReview(
  channel: HumanChannel | undefined,
  draft: MachineConsensusDraft,
  options: HumanReviewOptions = {},
): Promise<HumanReview> {
  const base: HumanReview = { draft, status: 'pending_human' };

  if (!channel) {
    return { ...base, humanNote: '无 HumanChannel：机器不擅权，待人工接入确认' };
  }

  // 选节点：指定或第一个在线节点
  const nodeId = options.nodeId;
  const node = nodeId ? channel.getNode(nodeId) : undefined;
  if (!node) {
    return { ...base, humanNote: '无在线人类节点：机器草案待人工确认' };
  }

  // 发送草案（用 HumanChannel 现有异步传输层）
  // 注：此处仅发起请求并标记 pending；真实部署中由外层 pollResponse 获裁决。
  // 为保持 injectCognition 同步友好且不阻塞，本函数不真正 await 人类回复，
  // 而是把草案推入通道并立即返回 pending_human；裁决由 HumanChannel.pollResponse 异步回填。
  try {
    const prompt =
      `【大成智慧学会商草案·请以人为主裁决】\n` +
      `立场: ${draft.stance} (机器置信 ${Math.round(draft.confidence * 100)}%)\n` +
      `摘要: ${draft.summary}\n` +
      `会商桥: ${draft.bridges.join('、')}\n` +
      `依据: ${draft.basis.join('；')}\n` +
      `请裁决: confirm(确认) / revise(修订) / reject(否决)`;
    await channel.sendAsync(node.id, prompt, { priority: 2, ttl: options.timeoutMs ?? 300000 });
  } catch {
    // 通道不可达 → 仍 pending，不阻塞
    return { ...base, humanNote: 'HumanChannel 发送失败：机器草案待人工确认' };
  }

  return { ...base, humanNote: `已提交人工节点 ${node.name}，待裁决（人以为主）` };
}

/**
 * 应用人的裁决到机器草案，产出最终 HumanReview。
 * 供外层在拿到 HumanChannel 裁决后调用，完成"人以为主"闭环。
 */
export function applyHumanVerdict(
  review: HumanReview,
  verdict: HumanVerdict,
  decidedBy: string,
  note?: string,
  finalStance?: string,
): HumanReview {
  return {
    ...review,
    status: verdict === 'confirm' ? 'confirmed' : verdict === 'revise' ? 'revised' : 'rejected',
    finalStance: verdict === 'confirm' ? review.draft.stance : (finalStance ?? review.draft.stance),
    humanNote: note,
    decidedBy,
    decidedAt: Date.now(),
  };
}
