/**
 * KunlunOS 主入口 — 以大成智慧学为运行、以 Pi Agent 为微内核的认知操作系统
 *
 * 架构：
 *   Pi Agent (Agent/AgentHarness) → 微内核层（LLM调用 + 工具执行 + 消息流）
 *   昆仑OS                         → 认知调度层（大成智慧学综合集成）
 *
 * 关键原则：昆仑OS 调度 Pi，不是 Pi 调度昆仑OS。
 *
 * 每次 LLM 调用前，昆仑OS 执行大成智慧学管线：
 *   用户输入 → 十一桥路由 → 知识卡片加载 → 矛盾分析 → 综合集成 → prompt 注入
 *
 * 每次工具调用前，通过安全管线决策是否放行。
 */

import type { Trit, Tryte } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import { createContradictionEngine } from '@kunlun/contradiction';
import type { ContradictionEngine } from '@kunlun/contradiction';
import { PracticeSpiralEngine } from '@kunlun/spiral';
import { ProtractedWarEngine } from '@kunlun/pw';
import { MetaSynthesisEngine } from './cog/metasynthesis';
import type { SynthesisParticipant } from './cog/metasynthesis';
import {
  ConfidenceTagRenderer,
  ContradictionVisualizer,
  DomainRouter,
  TernarySecurityPipeline,
  PipelineLayer,
} from '@kunlun/subsystems';
import type { RenderOutput } from '@kunlun/subsystems';

import type { KunlunOSConfig, OSStatus, OSState, BootPhaseLog } from './types';
import { defaultOSConfig } from './types';
import { CogBoot } from './boot';
import type { BootResult } from './boot';

// ─── 大成智慧学：十一桥 ───
import {
  routeToBridge,
  routeToBridges,
  getBridgeCards,
  getBridgeAxiom,
  type BridgeProfile,
  type KnowledgeCard,
} from './eleven-bridges.js';
import {
  analyzeBridgeDualAxis,
  type BridgeDualAxis,
} from './bridge-agent.js';
import {
  runLongmen,
} from './longmen.js';
import {
  requestHumanReview,
  type HumanReview,
  type MachineConsensusDraft,
} from './human-in-loop.js';

// ─── 认知分析结果 ──────────────────────────────────────────

export interface KunlunAnalysis {
  contradictions: Array<{ thesis: string; antithesis: string }>;
  unifiability: Trit;
  dominantAspect: Trit;
  qualitativeState: Trit;
  strategy?: string;
  memoryContext?: string;
  ecosystemHealth?: Trit;
  summary: string;
  /** 大成智慧学：路由到的主桥（多桥命中中的第一座，向后兼容） */
  bridge?: { id: string; name: string; icon: string; axiom: string };
  /** 大成智慧学：命中的全部学科桥（多桥会商） */
  bridges?: Array<{ id: string; name: string; icon: string; axiom: string }>;
  /** 大成智慧学：加载的知识卡片 */
  knowledgeCards?: Array<{ id: string; title: string; type: string }>;
  /** 大成智慧学：综合集成结果 */
  synthesis?: { stance: string; confidence: number };
  /** 大成智慧学：双轴子代理意见（每座命中桥的量智+性智） */
  dualAxes?: Array<{
    bridgeId: string; bridgeName: string; icon: string;
    liangZhi: { stance: number; reasoning: string; confidence: number; cards: string[] };
    xingZhi: { stance: number; reasoning: string; confidence: number; cards: string[] };
  }>;
  /** 大成智慧学：龙门补录（知识自进化草稿） */
  longmen?: { detected: boolean; drafts: Array<{
    id: string; bridgeId: string; layer: string; type: string;
    title: string; content: string; sourceBasis: string; confidence: number; status: string;
  }> };
  /** 大成智慧学：人以为主裁决（机器草案 + 人的最终裁决） */
  humanReview?: {
    status: string;
    draftStance: string;
    draftConfidence: number;
    finalStance?: string;
    humanNote?: string;
    decidedBy?: string;
  };
  /** 天工渲染：三元信度标注输出 */
  rendered?: { overallConfidence: string; summary: string };
  /** 注入到 LLM system prompt 的格式化文本 */
  promptInjection: string;
}

// ─── 工具安全决策 ──────────────────────────────────────────

export interface KunlunToolDecision {
  allowed: boolean;
  blockReason?: string;
  suggestedAlternative?: string;
  priority?: number;
}

// ═══════════════════════════════════════════════════════════════
// KunlunOS 主类
// ═══════════════════════════════════════════════════════════════

export class KunlunOS {
  private config: KunlunOSConfig;
  private status: OSStatus = 'stopped';
  private startTime: number = 0;
  private _pipelineRuns = 0;
  private _bootLogs: BootPhaseLog[] = [];

  // CogBoot 引导结果（init/start 后可用）
  private bootResult: BootResult | null = null;

  // 核心引擎（在 init 期间通过 CogBoot 初始化）
  private _contradiction!: ContradictionEngine;
  private _spiral!: PracticeSpiralEngine;
  private _protractedWar!: ProtractedWarEngine;
  private _metasynthesis!: MetaSynthesisEngine;
  private _tiangong: ConfidenceTagRenderer;
  private _visualizer: ContradictionVisualizer;
  private _domainRouter: DomainRouter;
  private _securityPipeline: TernarySecurityPipeline;

  // Pi Agent 引用
  piAgent: unknown = null;

  constructor(config: Partial<KunlunOSConfig> = {}) {
    this.config = { ...defaultOSConfig(), ...config };
    this._tiangong = new ConfidenceTagRenderer();
    this._visualizer = new ContradictionVisualizer();
    this._domainRouter = new DomainRouter();
    this._securityPipeline = new TernarySecurityPipeline();
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化昆仑OS（执行 CogBoot 引导，但不启动运行时）
   * 调用后状态变为 'booting'
   */
  async init(): Promise<void> {
    if (this.status !== 'stopped') return;
    this.status = 'booting';
    this.startTime = Date.now();

    this.log('昆仑OS 认知操作系统初始化中...');

    // 执行 CogBoot 6 阶段引导
    const boot = new CogBoot(this.config);
    this.bootResult = await boot.start();
    this._bootLogs = [...this.bootResult.logs];

    // 初始化核心引擎
    this._contradiction = createContradictionEngine();
    this._spiral = new PracticeSpiralEngine();
    this._protractedWar = new ProtractedWarEngine();
    this._metasynthesis = new MetaSynthesisEngine();

    this.log(`  - 矛盾引擎: 就绪 (8分析器)`);
    this.log(`  - 持久战引擎: 就绪 (三阶段)`);
    this.log(`  - 实践螺旋: 就绪 (四阶段)`);
    this.log(`  - 调度器: 就绪 (${this.bootResult.instanceIds.length} 实例)`);
    this.log(`  - 事件总线: 就绪 (双通道)`);
    this.log(`  - 算法注册表: ${this.bootResult.algoRegistry.listAlgorithms().length} 个插件`);

    this.log(`✅ ${this.config.instanceId} 初始化完成`);
  }

  /**
   * 启动昆仑OS（等同于 init + 启动运行时）
   * 调用后状态变为 'running'
   */
  async start(): Promise<void> {
    if (this.status === 'running') return;

    // 如果尚未初始化，先执行 init
    if (!this.bootResult) {
      await this.init();
    }

    this.status = 'running';
    this.log(`${this.config.instanceId} 已启动`);
  }

  /** 停止昆仑OS */
  stop(): void {
    if (this.bootResult) {
      this.bootResult.scheduler.stopGC();
      this.bootResult.scheduler.reset();
    }
    this.status = 'stopped';
    this.startTime = 0;
    this.log('昆仑OS 已停止');
  }

  /** 暂停 */
  pause(): void {
    if (this.status === 'running') this.status = 'paused';
  }

  /** 恢复 */
  resume(): void {
    if (this.status === 'paused') this.status = 'running';
  }

  // ═══════════════════════════════════════════════════════════
  // 子系统访问器（需在 boot 后调用）
  // ═══════════════════════════════════════════════════════════

  private ensureBooted(): BootResult {
    if (!this.bootResult) {
      throw new Error('KunlunOS has not been booted. Call start() or init() first.');
    }
    return this.bootResult;
  }

  getScheduler() { return this.ensureBooted().scheduler; }
  getMultiInstance() { return this.ensureBooted().multiInstance; }
  getIpc() { return this.ensureBooted().ipc; }
  getBus() { return this.ensureBooted().bus; }
  getAlgoRegistry() { return this.ensureBooted().algoRegistry; }
  getCapabilityRegistry() { return this.ensureBooted().capabilityRegistry; }
  getTrustManager() { return this.ensureBooted().trustManager; }
  getTokenManager() { return this.ensureBooted().tokenManager; }
  getAttentionScheduler() { return this.ensureBooted().attentionScheduler; }
  getPipeline() { return this.ensureBooted().pipeline; }
  getProcessManager() { return this.ensureBooted().processManager; }
  getHumanChannel() { return this.ensureBooted().humanChannel; }
  getMetasynthesisEngine() { return this.ensureBooted().metasynthesisEngine; }
  getMetasynthesisWorkshop() { return this.ensureBooted().metasynthesisWorkshop; }
  getExecutor() { return this.ensureBooted().executor; }

  /** 获取引导日志 */
  getBootLogs(): BootPhaseLog[] {
    return [...this._bootLogs];
  }

  /** 递增管道运行计数 */
  incrementPipelineRuns(): void {
    this._pipelineRuns++;
  }

  // ═══════════════════════════════════════════════════════════
  // 核心引擎访问器（兼容旧 API）
  // ═══════════════════════════════════════════════════════════

  get contradiction(): ContradictionEngine {
    return this._contradiction;
  }

  get spiral(): PracticeSpiralEngine {
    return this._spiral;
  }

  get protractedWar(): ProtractedWarEngine {
    return this._protractedWar;
  }

  // ═══════════════════════════════════════════════════════════
  // 核心 API：大成智慧学认知注入
  // ═══════════════════════════════════════════════════════════

  /**
   * 大成智慧学认知分析管线
   *
   * 每次 LLM 调用前执行，将分析结果注入 system prompt：
   *
   *   用户输入
   *     → 十一桥路由 (routeToBridge)
   *     → 加载知识卡片 (AX/SC/TC)
   *     → 矛盾分析 (ContradictionEngine)
   *     → 策略分析 (ProtractedWar / PracticeSpiral)
   *     → 综合集成 (MetaSynthesisEngine)
   *     → 生成 promptInjection
   */
  async injectCognition(
    messages: Array<{ role: string; content: unknown }>,
    systemPrompt: string,
  ): Promise<KunlunAnalysis> {
    if (!this._contradiction) {
      return this.emptyAnalysis();
    }

    // 提取最新用户消息
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const queryText = lastUserMsg
      ? (typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : Array.isArray(lastUserMsg.content)
          ? lastUserMsg.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join(' ')
          : '')
      : '';

    if (!queryText) return this.emptyAnalysis();

    // ── 阶段1：十一桥多桥路由 ──
    // 大成智慧学：问题常跨多个学科部门，命中所有相关桥而非归并到一座
    const bridgeHits = routeToBridges(queryText);
    const bridge = bridgeHits[0]!.bridge;           // 主桥（兼容）
    const axiom = getBridgeAxiom(bridge.id);
    // 合并所有命中桥的卡片（去重按 id）
    const cards: KnowledgeCard[] = Array.from(
      new Map<string, KnowledgeCard>(
        bridgeHits.flatMap(h => getBridgeCards(h.bridge.id)).map((c): [string, KnowledgeCard] => [c.id, c])
      ).values()
    );

    // ── 阶段2：矛盾感知（谛听） ──
    const contradictions: Array<{ thesis: string; antithesis: string }> = [];
    let unifiability: Trit = T_UNKNOWN;
    let dominantAspect: Trit = T_UNKNOWN;
    let qualitativeState: Trit = T_FALSE;

    const extracted = this.extractContradictions(queryText);
    contradictions.push(...extracted);

    if (contradictions.length > 0) {
      try {
        const result = this._contradiction.analyzeSingle({
          id: `kunlun-${Date.now()}`,
          thesis: {
            id: `th-${Date.now()}`,
            statement: contradictions[0]!.thesis,
            domain: bridge.name,
            evidence: [],
            counterEvidence: [],
            confidenceTrit: T_UNKNOWN,
            confidenceVector: [0, 0, 0, 0, 0, 0] as Tryte,
            source: { type: 'perception', signalId: 'kunlun' },
            dependencies: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          antithesis: {
            id: `at-${Date.now()}`,
            statement: contradictions[0]!.antithesis,
            domain: bridge.name,
            evidence: [],
            counterEvidence: [],
            confidenceTrit: T_UNKNOWN,
            confidenceVector: [0, 0, 0, 0, 0, 0] as Tryte,
            source: { type: 'perception', signalId: 'kunlun' },
            dependencies: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          contradictionType: 'non_antagonistic',
          discoveredBy: 'diting_perception',
          discoveredAt: Date.now(),
          relatedContradictions: [],
          priority: 0.5,
          presenceStateAtDiscovery: 'active' as any,
          warPhaseAtDiscovery: 'stalemate' as any,
        });

        unifiability = result.analysis.unifiability;
        dominantAspect = result.analysis.dominantAspect;
        qualitativeState = result.qualitativeChange.approachingThreshold;
      } catch {
        // 降级：纯规则模式
      }
    }

    // ── 阶段3：策略分析 ──
    let strategy: string | undefined;
    let memoryContext: string | undefined;
    let ecosystemHealth: Trit | undefined;

    if (this._protractedWar && this.matchesStrategy(queryText)) {
      try {
        const pwCtx = {
          totalRuntime: Date.now() - this.startTime,
          currentPhaseDuration: 0,
          phaseHistory: [] as any[],
          powerSnapshot: {
            relativeStrengthRatio: 0.5,
            strengthTrend: [0.4, 0.45, 0.5] as number[],
            capabilities: {} as Record<string, number>,
          },
          activeContradictions: [] as any[],
          spiralMetrics: {
            recentAscensionRatio: { ascension: 1, flat: 2, regression: 0 },
            recentBreakthroughs: 0,
          },
          criticalEvents: [] as any[],
        };
        const phase = await this._protractedWar.assessPhase(pwCtx as any);
        const labels: Record<string, string> = {
          defense: '🛡️ 防御阶段', stalemate: '⚔️ 相持阶段', counteroffensive: '⚡ 反攻阶段',
        };
        strategy = `策略阶段: ${labels[phase.currentPhase] ?? phase.currentPhase}`;
      } catch { /* ignore */ }
    }

    if (this._spiral && this.matchesSpiral(queryText)) {
      try {
        const ctx = {
          domain: queryText,
          hypothesis: queryText,
          environment: { type: 'simulation' as const, constraints: [] },
          relatedContradictions: [] as any[],
        };
        const result = await this._spiral.engagePractice(ctx as any);
        if (result.emergentObservations?.length) {
          strategy = (strategy ? strategy + '；' : '') + `实践洞察: ${result.emergentObservations.join('; ')}`;
        }
      } catch { /* ignore */ }
    }

    // ── 阶段3.5：双轴子代理（量智 + 性智）──
    // 大成智慧学：每座命中桥挂两个子代理，分别做逻辑推演(量智)与整体综合(性智)
    const dualAxes = bridgeHits.map(h => analyzeBridgeDualAxis(h.bridge, queryText));

    // ── 阶段4：综合集成（大成智慧学核心） ──
    let synthesisResult: { stance: string; confidence: number } | undefined;

    if (this._metasynthesis && contradictions.length > 0) {
      try {
        // 构建研讨参与者：矛盾正反方(带可统一性立场) + 每座桥的「量智」「性智」双轴子代理
        //  Thesis/Antithesis 立场由谛听感知的可统一性(unifiability)映射，使矛盾信号进入共识
        const thesisStance = unifiability === T_TRUE ? T_TRUE
          : unifiability === T_FALSE ? T_FALSE : T_UNKNOWN;
        const antiStance = unifiability === T_TRUE ? T_FALSE
          : unifiability === T_FALSE ? T_TRUE : T_UNKNOWN;
        const participants: SynthesisParticipant[] = [
          {
            id: 'thesis', name: contradictions[0]?.thesis ?? '正题', type: 'pi-agent',
            stance: thesisStance,
            reasoning: `正题立场（谛听可统一性=${unifiability}）`,
            confidence: unifiability !== T_UNKNOWN ? 0.7 : 0.4,
          },
          {
            id: 'antithesis', name: contradictions[0]?.antithesis ?? '反题', type: 'pi-agent',
            stance: antiStance,
            reasoning: `反题立场（谛听可统一性=${unifiability}）`,
            confidence: unifiability !== T_UNKNOWN ? 0.7 : 0.4,
          },
          ...dualAxes.flatMap(d => [
            {
              id: `lz-${d.bridgeId}`,
              name: `${d.icon} ${d.bridgeName}·量智`,
              type: 'pi-agent' as const,
              stance: d.liangZhi.stance,
              reasoning: d.liangZhi.reasoning,
              confidence: d.liangZhi.confidence,
            },
            {
              id: `xz-${d.bridgeId}`,
              name: `${d.icon} ${d.bridgeName}·性智`,
              type: 'pi-agent' as const,
              stance: d.xingZhi.stance,
              reasoning: d.xingZhi.reasoning,
              confidence: d.xingZhi.confidence,
            },
          ]),
        ];

        const synthesis = await this._metasynthesis.synthesize(queryText, participants);
        const stanceLabel = synthesis.consensus.stance === 1 ? '正题主导'
          : synthesis.consensus.stance === -1 ? '反题主导'
          : '均势待定';

        synthesisResult = {
          stance: stanceLabel,
          confidence: Math.round(synthesis.overallConfidence * 100) / 100,
        };
      } catch { /* ignore */ }
    }

    // ── 阶段4.5：人以为主裁决（大成智慧学"人—机结合以人为主"）──
    // 机器综合集成只是"草案"，最终裁决权在人；无人在线则诚实标记 pending_human
    let humanReview: HumanReview | undefined;
    if (synthesisResult && contradictions.length > 0) {
      try {
        const draft: MachineConsensusDraft = {
          stance: synthesisResult.stance,
          confidence: synthesisResult.confidence,
          summary: '(详见摘要)',
          bridges: bridgeHits.map(h => `${h.bridge.icon}${h.bridge.name}`),
          basis: dualAxes.map(d =>
            `〔${d.bridgeName}〕量智:${d.liangZhi.reasoning}；性智:${d.xingZhi.reasoning}`,
          ),
        };
        humanReview = await requestHumanReview(this.getHumanChannel(), draft);
      } catch { /* 无人在线走 pending，不阻塞 */ }
    }

    // ── 阶段5: 天工渲染（三元信度驱动的表达） ──
    let renderedOutput: { overallConfidence: string; summary: string } | undefined;

    if (contradictions.length > 0) {
      try {
        // 三元信度：谛听可统一性(unifiability) + 加权共识立场(synthesisResult.stance)
        // 二者并置，天工呈现"矛盾可统一程度"与"会商最终立场"双信号
        const consensusTrit: Trit = synthesisResult
          ? (synthesisResult.stance.includes('正题主导') ? T_TRUE
             : synthesisResult.stance.includes('反题主导') ? T_FALSE : T_UNKNOWN)
          : T_UNKNOWN;
        const trits: Trit[] = contradictions.map(() =>
          unifiability === T_TRUE ? T_TRUE : unifiability === T_FALSE ? T_FALSE : T_UNKNOWN
        );
        trits.push(consensusTrit); // 叠加会商立场

        const renderResult = this._tiangong.render(
          contradictions.map(c => `${c.thesis} ↔ ${c.antithesis}`).join('；'),
          trits,
        );
        const tag = this._tiangong.getTag(renderResult.overallConfidence);
        // 共识置信度接入天工：连续分级反映"系统有多确定"（约束4 不夸大）
        const grade = synthesisResult
          ? this._tiangong.getConfidenceGrade(synthesisResult.confidence)
          : this._tiangong.getConfidenceGrade(0);
        const confNote = synthesisResult
          ? `（共识置信 ${Math.round(synthesisResult.confidence * 100)}%·${grade.grade}）`
          : '';
        renderedOutput = {
          overallConfidence: `${tag.symbol} ${tag.label}${confNote}`,
          summary: `${renderResult.confidenceSummary}｜${grade.symbol} ${grade.grade}：${grade.note}`,
        };
      } catch { /* ignore */ }
    }

    // ── 构建分析摘要 ──
    const summaryParts: string[] = [];
    // 多桥命中：列出全部相关桥（大成智慧学跨域会商）
    summaryParts.push(
      bridgeHits.length > 1
        ? `📍 多桥会商[${bridgeHits.map(h => `${h.bridge.icon}${h.bridge.name}`).join('·')}]`
        : `📍 ${bridge.icon} ${bridge.name}桥`
    );

    if (contradictions.length > 0) {
      const unifLabel = unifiability === 1 ? '可统一 ✅' : unifiability === 0 ? '待分析 ⚪' : '不可调和 ❌';
      summaryParts.push(`${contradictions.length}组矛盾，${unifLabel}`);
    }
    if (synthesisResult) {
      summaryParts.push(`综合集成: ${synthesisResult.stance}(${synthesisResult.confidence})`);
    }
    if (strategy) {
      summaryParts.push(strategy);
    }

    const summary = summaryParts.join(' | ') || '基础认知模式';

    // ── 构建 prompt 注入 ──
    const promptInjection = this.buildPromptInjection({
      contradictions,
      unifiability,
      dominantAspect,
      strategy,
      summary,
      bridge,
      cards,
      axiom,
      synthesis: synthesisResult,
      rendered: renderedOutput,
    });

    // ── 阶段5：龙门（知识自进化）──
    // 大成智慧学：判不出的桥即缺卡信号，龙门探测缺口并生成补录草稿
    const longmen = runLongmen(dualAxes, queryText);

    return {
      contradictions,
      unifiability,
      dominantAspect,
      qualitativeState,
      strategy,
      memoryContext,
      ecosystemHealth,
      summary,
      bridge: { id: bridge.id, name: bridge.name, icon: bridge.icon, axiom },
      bridges: bridgeHits.map(h => ({
        id: h.bridge.id, name: h.bridge.name, icon: h.bridge.icon, axiom: getBridgeAxiom(h.bridge.id),
      })),
      knowledgeCards: cards.map(c => ({ id: c.id, title: c.title, type: c.type })),
      synthesis: synthesisResult,
      rendered: renderedOutput,
      dualAxes: dualAxes.map(d => ({
        bridgeId: d.bridgeId, bridgeName: d.bridgeName, icon: d.icon,
        liangZhi: { stance: d.liangZhi.stance, reasoning: d.liangZhi.reasoning, confidence: d.liangZhi.confidence, cards: d.liangZhi.cards },
        xingZhi: { stance: d.xingZhi.stance, reasoning: d.xingZhi.reasoning, confidence: d.xingZhi.confidence, cards: d.xingZhi.cards },
      })),
      longmen: {
        detected: longmen.detected,
        drafts: longmen.drafts.map(d => ({
          id: d.id, bridgeId: d.bridgeId, layer: d.layer, type: d.type,
          title: d.title, content: d.content, sourceBasis: d.sourceBasis, confidence: d.confidence,           status: d.status,
        })),
      },
      humanReview: humanReview ? {
        status: humanReview.status,
        draftStance: humanReview.draft.stance,
        draftConfidence: humanReview.draft.confidence,
        finalStance: humanReview.finalStance,
        humanNote: humanReview.humanNote,
        decidedBy: humanReview.decidedBy,
      } : undefined,
      promptInjection,
    };
  }

  /**
   * 工具安全决策 — 在 Pi 执行工具前调用
   * 用作 Pi AgentLoopConfig.beforeToolCall 的回调
   */
  decideTool(
    toolName: string,
    toolArgs: Record<string, unknown>,
    latestAnalysis?: KunlunAnalysis | null,
  ): KunlunToolDecision {
    const name = toolName.toLowerCase();

    // 读操作始终放行
    if (/^(read|list|search|ls|cat|get|fetch|find|rg|grep)/.test(name)) {
      return { allowed: true, priority: 8 };
    }

    // 写操作：矛盾激烈时阻止
    if (/^(write|edit|delete|remove|mv|cp|patch)/.test(name)) {
      if (latestAnalysis && latestAnalysis.contradictions.length > 0 && latestAnalysis.unifiability === T_FALSE) {
        return {
          allowed: false,
          blockReason: `🔒 昆仑OS: 检测到不可调和矛盾，建议先分析再修改`,
          suggestedAlternative: 'read',
          priority: 0,
        };
      }
      return { allowed: true, priority: 2 };
    }

    // 执行类：中等优先级
    if (/^(bash|run|exec|test)/.test(name)) {
      return { allowed: true, priority: 5 };
    }

    return { allowed: true, priority: 3 };
  }

  // ═══════════════════════════════════════════════════════════
  // 查询与状态
  // ═══════════════════════════════════════════════════════════

  getState(): OSState {
    const instanceCount = this.bootResult
      ? this.bootResult.scheduler.getInstanceIds().length
      : 0;
    const taskCount = this.bootResult
      ? this.bootResult.scheduler.getTasks().length
      : 0;

    return {
      status: this.status,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      instanceCount,
      taskCount,
      pipelineRuns: this._pipelineRuns,
    };
  }

  getConfig(): KunlunOSConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.status === 'running';
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════

  private emptyAnalysis(): KunlunAnalysis {
    return {
      contradictions: [],
      unifiability: T_UNKNOWN,
      dominantAspect: T_UNKNOWN,
      qualitativeState: T_FALSE,
      summary: '无用户输入',
      promptInjection: '',
    };
  }

  private extractContradictions(query: string): Array<{ thesis: string; antithesis: string }> {
    const pairs: Array<{ thesis: string; antithesis: string }> = [];

    // "A vs B" 模式
    const vsMatch = query.match(/(.+?)\s+(?:vs|VS|和|与|跟)\s+(.+?)(?:\s+的[矛盾冲突]|$|[，。])/);
    if (vsMatch) {
      pairs.push({ thesis: vsMatch[1]!.trim(), antithesis: vsMatch[2]!.trim() });
      return pairs;
    }

    // "A 但 B" 模式
    const butMatch = query.match(/(.+?)但(?:是)?(.+?)(?:$|[，。])/);
    if (butMatch) {
      pairs.push({ thesis: butMatch[1]!.trim(), antithesis: butMatch[2]!.trim() });
      return pairs;
    }

    // "A 与 B 的矛盾/冲突/权衡/取舍" 模式
    const conflictMatch = query.match(/(.+?)(?:的)(?:矛盾|冲突|权衡|取舍|两难|困境)/);
    if (conflictMatch) {
      // 尝试从语境中提取对立面
      const subject = conflictMatch[1]!.trim();
      pairs.push({ thesis: `追求${subject}`, antithesis: `避免${subject}带来的代价` });
      return pairs;
    }

    // 检测"转型/变革/挑战"暗示的新旧矛盾
    if (/转型|变革|升级|数字化|智能化/.test(query)) {
      const entities = query.replace(/[的之]/g, '').split(/[，。,\.\s]+/).filter(s => s.length > 2);
      if (entities.length >= 2) {
        pairs.push({ thesis: `推动${entities[0]}`, antithesis: `应对${entities[1] || '阻力'}` });
      } else {
        pairs.push({ thesis: '变革创新', antithesis: '维持稳定' });
      }
      return pairs;
    }

    // 常见矛盾对（扩展版，增加覆盖）
    const patterns: Array<[string, string, string[]]> = [
      ['性能', '成本', ['性能', '成本']],
      ['效率', '质量', ['效率', '质量']],
      ['创新', '稳定', ['创新', '稳定']],
      ['安全', '便捷', ['安全', '便捷', '效率']],
      ['开放', '控制', ['开放', '管控']],
      ['速度', '质量', ['快', '好', '速度', '质量']],
      ['集中', '分布', ['集中', '分布', '单体', '微服务']],
      ['短期', '长期', ['短期', '长期', '当下', '未来']],
      ['个性化', '规模化', ['个性', '规模', '定制', '标准']],
      ['探索', '利用', ['探索', '利用', '创新', '优化']],
      ['自主', '协同', ['自主', '协同', '独立', '合作']],
      ['简单', '复杂', ['简单', '复杂', '简洁', '丰富']],
      ['技术', '业务', ['技术', '业务']],
      ['数据', '隐私', ['数据', '隐私']],
    ];

    for (const [a, b, keywords] of patterns) {
      if (keywords.some(k => query.includes(k))) {
        pairs.push({ thesis: `追求${a}`, antithesis: `保证${b}` });
      }
    }

    return pairs;
  }

  private matchesStrategy(query: string): boolean {
    return /战略|规划|计划|持久战|阶段|发展|转型|升级|策略/.test(query);
  }

  private matchesSpiral(query: string): boolean {
    return /学习|反思|迭代|改进|优化|复盘|实践/.test(query);
  }

  private buildPromptInjection(analysis: {
    contradictions: Array<{ thesis: string; antithesis: string }>;
    unifiability: Trit;
    dominantAspect: Trit;
    strategy?: string;
    summary: string;
    bridge?: BridgeProfile;
    cards?: KnowledgeCard[];
    axiom?: string;
    synthesis?: { stance: string; confidence: number };
    rendered?: { overallConfidence: string; summary: string };
  }): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('─── 大成智慧学·认知分析（昆仑OS） ───');
    lines.push('');

    // ── 十一桥路由 ──
    if (analysis.bridge) {
      lines.push(`【${analysis.bridge.icon} ${analysis.bridge.name}桥】${analysis.bridge.axiom}`);
      lines.push('');
    }

    // ── 知识卡片 ──
    if (analysis.cards && analysis.cards.length > 0) {
      lines.push('【知识卡片】');
      const axCard = analysis.cards.find(c => c.type === 'AX');
      const scCard = analysis.cards.find(c => c.type === 'SC');
      const tcCard = analysis.cards.find(c => c.type === 'TC');
      if (axCard) lines.push(`  公理: ${axCard.title}`);
      if (scCard) lines.push(`  学科: ${scCard.title}`);
      if (tcCard) lines.push(`  工具: ${tcCard.title}`);
      lines.push('');
    }

    // ── 矛盾感知 ──
    if (analysis.contradictions.length > 0) {
      lines.push('【矛盾感知】');
      for (const c of analysis.contradictions) {
        lines.push(`  · ${c.thesis} ↔ ${c.antithesis}`);
      }
      const unifLabel = analysis.unifiability === 1 ? '可统一 ✅' : analysis.unifiability === 0 ? '待分析 ⚪' : '不可调和 ❌';
      lines.push(`  整体矛盾状态：${unifLabel}`);
      const aspectLabel = analysis.dominantAspect === 1 ? '正题主导' : analysis.dominantAspect === -1 ? '反题主导' : '均势';
      lines.push(`  主导方面：${aspectLabel}`);
      lines.push('');
    }

    // ── 综合集成 ──
    if (analysis.synthesis) {
      lines.push('【综合集成】');
      lines.push(`  共识立场: ${analysis.synthesis.stance}`);
      lines.push(`  置信度: ${analysis.synthesis.confidence}`);
      lines.push('');
    }

    // ── 天工渲染 ──
    if (analysis.rendered) {
      lines.push('【天工渲染】');
      lines.push(`  信度: ${analysis.rendered.overallConfidence}`);
      lines.push(`  ${analysis.rendered.summary}`);
      lines.push('');
    }

    // ── 策略建议 ──
    if (analysis.strategy) {
      lines.push('【策略建议】');
      lines.push(`  ${analysis.strategy}`);
      lines.push('');
    }

    lines.push('【分析摘要】' + analysis.summary);
    lines.push('────────────────────────────');
    lines.push('');

    return lines.join('\n');
  }

  private log(message: string): void {
    if (this.config.verbose) {
      const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
      console.log(`[${ts}] [KunlunOS] ${message}`);
    }
  }
}

// ─── 便捷工厂 ──────────────────────────────────────────────

let globalOS: KunlunOS | null = null;

/** 获取或创建全局昆仑OS 实例 */
export function getKunlunOS(config?: Partial<KunlunOSConfig>): KunlunOS {
  if (!globalOS) {
    globalOS = new KunlunOS(config);
  }
  return globalOS;
}

/** 启动全局昆仑OS */
export async function bootKunlunOS(config?: Partial<KunlunOSConfig>): Promise<KunlunOS> {
  const os = getKunlunOS(config);
  await os.start();
  return os;
}
