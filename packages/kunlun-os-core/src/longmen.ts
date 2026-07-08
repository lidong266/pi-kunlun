/**
 * 龙门（Dragon Gate）— 大成智慧学知识自进化机制
 * [成熟度: 种子期→成长期] 刚接通；当前为缺桥探测+草稿，promote 后写归藏；待积累真·演化飞轮
 *
 * 钱学森"从定性到定量综合集成"不是一次性工程，而是持续迭代的研讨厅。
 * 龙门即系统自我进化的闸门：当某学科桥"判不出"（双轴子代理皆 UNKNOWN）时，
 * 说明该桥知识卡片稀疏（种子期真实短板），龙门自动探测缺口、生成补录草稿、
 * 经三元校验后写入归藏，使系统"越用越聪明"。
 *
 * 状态机（架构文档 §四）：
 *   缺桥探测 → 探针生成 → 三元校验 → 写归藏(跃迁)
 *
 * 防注水三铁律（架构文档 §四 + 约束6）：
 *   1. 三元坐标强制：每条草稿必须带 (bridgeId, layer, type) 桥坐标
 *   2. 溯源强制：source_basis 必须标注（龙门草稿一律标记 auto-proposed，非权威卡）
 *   3. 不覆盖：草稿 ID 不与既有卡冲突，promote 只追加不覆盖
 *
 * 设计约束：纯内存草稿池 + JSONL 文件日志，不依赖 sqlite，可单测、可重放。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { T_UNKNOWN, type Trit } from '@kunlun/ternary';
import {
  ELEVEN_BRIDGES,
  type BridgeProfile,
  type KnowledgeCard,
} from './eleven-bridges.js';
import type { BridgeDualAxis } from './bridge-agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, 'logs');
const DRAFT_LOG = join(LOG_DIR, 'longmen-drafts.log');

// ─────────────────────────────────────────────────────────────
// 龙门草稿
// ─────────────────────────────────────────────────────────────

export interface LongmenDraft {
  id: string;
  ts: string;
  bridgeId: string;
  layer: '基础学科' | '科学技术' | '工程技术';
  type: 'AX' | 'SC' | 'TC';
  title: string;
  content: string;
  tags: string[];
  /** 溯源：龙门草稿一律标 auto-proposed（约束6 — 非权威卡，需人工/置信跃迁） */
  sourceBasis: string;
  confidence: number;
  status: 'draft' | 'promoted' | 'rejected';
}

// 内存草稿池（进程内去重 + 展示用）
const draftPool: LongmenDraft[] = [];
let draftCounter = 0;

function logDraft(draft: Omit<LongmenDraft, 'id' | 'ts'>): LongmenDraft {
  const full: LongmenDraft = {
    id: `longmen-${++draftCounter}-${Date.now()}`,
    ts: new Date().toISOString(),
    ...draft,
  };
  draftPool.unshift(full);
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(DRAFT_LOG, JSON.stringify(full) + '\n');
  } catch { /* 文件日志失败不阻断主流程 */ }
  return full;
}

export function getLongmenDrafts(status?: LongmenDraft['status']): LongmenDraft[] {
  const pool = status ? draftPool.filter(d => d.status === status) : draftPool;
  return [...pool];
}

// ─────────────────────────────────────────────────────────────
// 阶段1：缺桥探测
// ─────────────────────────────────────────────────────────────

/**
 * 探测某桥是否"判不出"（双轴皆 UNKNOWN）。
 * 种子期卡片稀疏时，量智/性智都无命中 → 该桥缺卡信号。
 */
export function detectMissingBridge(d: BridgeDualAxis): boolean {
  return d.liangZhi.stance === T_UNKNOWN && d.xingZhi.stance === T_UNKNOWN;
}

// ─────────────────────────────────────────────────────────────
// 阶段2：探针生成（纯函数模板，收编自 extension/dragon-gate 思路，去 sqlite）
// ─────────────────────────────────────────────────────────────

function templateFor(bridgeName: string, layer: LongmenDraft['layer'], type: LongmenDraft['type']): { title: string; content: string } {
  const pairs: Record<string, Array<{ title: string; content: string }>> = {
    '基础学科|SC': [{ title: `${bridgeName}基础理论`, content: `${bridgeName}的核心概念体系：定义、分类与基本规律` }],
    '基础学科|TC': [{ title: `${bridgeName}基础概念辨析工具`, content: `辨析${bridgeName}基础概念混淆的结构化方法` }],
    '科学技术|AX': [{ title: '方法论的统一性原理', content: `${bridgeName}分析的方法论第一性原则：实事求是、尊重客观规律` }],
    '科学技术|TC': [{ title: `${bridgeName}分析方法论`, content: `${bridgeName}从问题到诊断的完整分析流程与指标体系` }],
    '工程技术|AX': [{ title: '实践检验的辩证原则', content: `实践—认识—再实践的辩证反馈原则在${bridgeName}的落实` }],
    '工程技术|SC': [{ title: `${bridgeName}工程实践`, content: `${bridgeName}主要工程范式、工具链与落地机制` }],
  };
  const list = pairs[`${layer}|${type}`];
  if (!list) return { title: `${bridgeName}·${layer}·${type}`, content: `${bridgeName}在${layer}层的${type}类知识待补录` };
  return list[0]!;
}

// ─────────────────────────────────────────────────────────────
// 阶段3+4：三元校验 + 写归藏（跃迁）
// ─────────────────────────────────────────────────────────────

/**
 * 为某桥生成补录草稿（已含三元坐标 + 溯源标记）。
 * 不写库，仅生成待审草稿；通过 verifyDraft 校验后由 promoteDraft 跃迁。
 */
export function proposeDraft(
  bridge: BridgeProfile,
  layer: LongmenDraft['layer'],
  type: LongmenDraft['type'],
  source: string,
  confidenceBase = 0.45,
): LongmenDraft | null {
  // 铁律1：三元坐标强制 —— 必带 bridgeId/layer/type（此处由参数保证）
  // 铁律3：不覆盖 —— 同桥同层同类型已存在则不重复建议
  const exists = bridge.cards.some(c => c.layer === layer && c.type === type);
  if (exists) return null;

  const { title, content } = templateFor(bridge.name, layer, type);
  const tags = [bridge.id, type, layer];

  return logDraft({
    bridgeId: bridge.id,
    layer,
    type,
    title,
    content,
    tags,
    sourceBasis: `auto-proposed (longmen) · 触发: ${source.slice(0, 80)}`,
    confidence: confidenceBase,
    status: 'draft',
  });
}

/**
 * 三元校验：龙门草稿准入闸门。
 * 铁律1 坐标齐全 / 铁律2 溯源非空 / 铁律3 不覆盖既有。
 */
export function verifyDraft(draft: LongmenDraft): { ok: boolean; reason?: string } {
  if (!draft.bridgeId || !draft.layer || !draft.type) {
    return { ok: false, reason: '缺三元坐标(bridgeId/layer/type)' };
  }
  if (!draft.sourceBasis || draft.sourceBasis.trim().length === 0) {
    return { ok: false, reason: '缺溯源 source_basis（防注水铁律2）' };
  }
  const bridge = ELEVEN_BRIDGES.find(b => b.id === draft.bridgeId);
  if (!bridge) return { ok: false, reason: `桥不存在: ${draft.bridgeId}` };
  const clash = bridge.cards.some(c => c.layer === draft.layer && c.type === draft.type);
  if (clash) return { ok: false, reason: '该层该类型卡已存在，不覆盖' };
  // 草稿 ID 不与既有卡冲突
  if (bridge.cards.some(c => c.id === draft.id.replace('longmen-', 'DG-'))) {
    return { ok: false, reason: 'ID 冲突' };
  }
  return { ok: true };
}

/**
 * 龙门跃迁：草稿通过校验后写入归藏（追加进 ELEVEN_BRIDGES 内存 + 标记 promoted）。
 * 返回是否成功；成功后该卡立即参与后续分析的路由/双轴。
 */
export function promoteDraft(draft: LongmenDraft): boolean {
  const verified = verifyDraft(draft);
  if (!verified.ok) return false;

  const bridge = ELEVEN_BRIDGES.find(b => b.id === draft.bridgeId);
  if (!bridge) return false;

  const card: KnowledgeCard = {
    id: draft.id.replace('longmen-', 'DG-'),
    bridgeId: draft.bridgeId,
    layer: draft.layer,
    type: draft.type,
    title: draft.title,
    content: draft.content,
    tags: draft.tags,
  };
  // 写归藏：追加不覆盖（约束5 — 归藏为唯一知识源，运行时可写）
  bridge.cards.push(card);
  draft.status = 'promoted';
  return true;
}

// ─────────────────────────────────────────────────────────────
// 一体化入口：分析后自动龙门
// ─────────────────────────────────────────────────────────────

export interface LongmenResult {
  detected: boolean;
  drafts: LongmenDraft[];
}

/**
 * 对一次分析的所有命中桥做缺桥探测 + 探针生成。
 * 仅当某桥"判不出"（双轴皆 UNKNOWN）时才建议补录该桥缺失的层/类型卡。
 * 默认补齐该桥三层中各缺的一张卡（AX/SC/TC 中缺失者）。
 */
export function runLongmen(dualAxes: BridgeDualAxis[], query: string): LongmenResult {
  const drafts: LongmenDraft[] = [];
  let detected = false;

  for (const d of dualAxes) {
    if (!detectMissingBridge(d)) continue;
    detected = true;
    const bridge = ELEVEN_BRIDGES.find(b => b.id === d.bridgeId);
    if (!bridge) continue;

    const layers: LongmenDraft['layer'][] = ['基础学科', '科学技术', '工程技术'];
    const types: LongmenDraft['type'][] = ['AX', 'SC', 'TC'];
    // 探测该桥缺哪些 (层,类型) 组合
    for (const layer of layers) {
      for (const type of types) {
        const exists = bridge.cards.some(c => c.layer === layer && c.type === type);
        if (exists) continue;
        const draft = proposeDraft(bridge, layer, type, query, 0.42 + (type === 'SC' ? 0.05 : 0));
        if (draft) drafts.push(draft);
      }
    }
  }

  return { detected, drafts };
}
