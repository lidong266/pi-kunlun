/**
 * KunlunOS 多微内核调度器 v3 — MapReduce 认知并行
 *
 * 核心思路：一个任务拆成 N 个子任务，N 个 Pi 并行执行，主 Pi 汇总。
 *
 *   用户: "分析这个项目，从技术、商业、风险三个角度"
 *     │
 *     ├─ 主 Pi (Map 阶段): injectCognition 拆解 → 3 个子任务
 *     │   ├─ Pi-1: "从技术角度分析这个项目" ─┐
 *     │   ├─ Pi-2: "从商业角度分析这个项目" ─┤ 并行 agent-loop
 *     │   └─ Pi-3: "从风险角度分析这个项目" ─┘
 *     │
 *     └─ 主 Pi (Reduce 阶段): 收集 3 个结果 → 综合集成 → 输出
 *
 * 共享层（所有 Pi 共享）:
 *   - TokenManager: 共享 Token 预算，避免重复消耗
 *   - Session: 共享上下文，子 Pi 的结果写入主 Pi 的 session
 *   - 认知引擎: injectCognition 共用（纯本地，不需要 Pi）
 */

import { CogScheduler, CogMultiInstanceManager, CogPriority } from '@kunlun/cogkal';
import { KunlunAgent } from './kunlun-agent.js';
import type { KunlunAgentOptions } from './kunlun-agent.js';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { KunlunAnalysis } from './kunlun-os.js';
import { SharedCognitiveLayer } from './shared-layer.js';
import type { SharedLayerConfig } from './shared-layer.js';

// ═══════════════════════════════════════════════════════════════
// 子任务
// ═══════════════════════════════════════════════════════════════

export interface SubTask {
  id: string;
  /** 子任务的独立 prompt */
  prompt: string;
  /** 子任务的 system prompt（可选） */
  systemPrompt?: string;
}

export interface SubTaskResult {
  taskId: string;
  result: AssistantMessage;
  /** 子 Pi 的认知分析结果 */
  analysis?: KunlunAnalysis;
}

// ═══════════════════════════════════════════════════════════════
// 内核池配置
// ═══════════════════════════════════════════════════════════════

export interface KernelPoolConfig {
  /** 并行 Pi 数量（默认 3） */
  workers?: number;
  /** 是否共享 Session（默认 true） */
  shareSession?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// MultiKernelOrchestrator v3
// ═══════════════════════════════════════════════════════════════

export class MultiKernelOrchestrator {
  private scheduler: CogScheduler;
  private multiInstance: CogMultiInstanceManager;
  /** 共享认知层（所有 Pi 共享 Token/缓存/记忆） */
  readonly shared: SharedCognitiveLayer;
  /** 主 Pi */
  private main: KunlunAgent;
  /** 工作 Pi 池 */
  private workers: KunlunAgent[] = [];
  private config: Required<KernelPoolConfig>;

  constructor(options: KunlunAgentOptions, config: KernelPoolConfig = {}, sharedConfig?: SharedLayerConfig) {
    this.config = {
      workers: config.workers ?? 3,
      shareSession: config.shareSession ?? true,
    };
    this.scheduler = new CogScheduler();
    this.multiInstance = new CogMultiInstanceManager(this.scheduler);
    this.shared = new SharedCognitiveLayer(sharedConfig);
    this.main = new KunlunAgent(options);
  }

  async start(): Promise<void> {
    await this.main.start();

    for (let i = 0; i < this.config.workers; i++) {
      const worker = new KunlunAgent({
        ...this.main['baseOptions'] as any || {},
        osConfig: { instanceId: `kunlun-worker-${i}` },
      });
      await worker.start();
      this.workers.push(worker);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 核心 API
  // ═══════════════════════════════════════════════════════════

  /** 主对话 */
  async prompt(text: string): Promise<AssistantMessage> {
    return this.main.harness.prompt(text);
  }

  /**
   * MapReduce: 拆解 → 并行 → 汇总
   *
   * 将一个复杂任务拆成 N 个子任务，分配给 N 个工作 Pi 并行执行，
   * 主 Pi 收集结果后综合输出。
   */
  async mapReduce(
    /** 用户原始问题 */
    query: string,
    /** 子任务列表（由 injectCognition 或外部提供） */
    subTasks: SubTask[],
    /** 汇总时的 system prompt */
    reducePrompt?: string,
  ): Promise<{
    /** 每个子任务的结果 */
    subResults: SubTaskResult[];
    /** 汇总后的最终回复 */
    finalReply: AssistantMessage;
    /** 总耗时 (ms) */
    elapsed: number;
  }> {
    const startTime = Date.now();

    // ── Map 阶段: N 个 Pi 并行执行 ──
    const subResults = await Promise.all(
      subTasks.map(async (task, index) => {
        const worker = this.workers[index % this.workers.length]!;
        const result = await worker.harness.prompt(task.prompt);
        const analysis = worker.getLatestAnalysis();
        return { taskId: task.id, result, analysis: analysis ?? undefined };
      })
    );

    // ── Reduce 阶段: 主 Pi 综合 ──
    const subResultsText = subResults
      .map((r, i) => `### 子任务${i + 1}: ${subTasks[i]!.prompt}\n${extractText(r.result)}`)
      .join('\n\n');

    const reduceInput = reducePrompt
      ? `${reducePrompt}\n\n${subResultsText}`
      : `以下是 ${subResults.length} 个子任务的分析结果，请综合这些结果给出最终回答。\n\n原始问题: ${query}\n\n${subResultsText}`;

    const finalReply = await this.main.harness.prompt(reduceInput);

    return {
      subResults,
      finalReply,
      elapsed: Date.now() - startTime,
    };
  }

  /**
   * 一键深度分析: 自动拆解 + 并行 + 汇总
   *
   * 这是最常用的入口——用户只需提出问题，
   * 昆仑OS 自动做认知拆解、多 Pi 并行、综合集成。
   */
  async deepAnalyze(query: string): Promise<{
    analysis: KunlunAnalysis;
    mapReduceResult: Awaited<ReturnType<typeof this.mapReduce>>;
    fromCache: boolean;
  }> {
    // 检查分析缓存
    const cachedAnalysis = this.shared.getCachedAnalysis(query);
    const analysis = cachedAnalysis ?? await this.main.os.injectCognition(
      [{ role: 'user', content: query }], ''
    );

    // 缓存分析结果
    if (!cachedAnalysis) {
      this.shared.cacheAnalysis(query, analysis);
    }

    // 根据矛盾分析自动拆解子任务
    const subTasks = this.decomposeFromAnalysis(query, analysis);

    // MapReduce（子 Pi 的结果会自动写入共享记忆）
    const mrResult = await this.mapReduce(query, subTasks);

    // 写入共享记忆
    this.shared.writeMemory(
      `分析: ${query} → ${analysis.summary}`,
      analysis.knowledgeCards?.map(c => c.id) ?? [],
    );

    return { analysis, mapReduceResult: mrResult, fromCache: !!cachedAnalysis };
  }

  // ═══════════════════════════════════════════════════════════
  // 内部
  // ═══════════════════════════════════════════════════════════

  /**
   * 从认知分析结果自动拆解子任务
   */
  private decomposeFromAnalysis(query: string, analysis: KunlunAnalysis): SubTask[] {
    const tasks: SubTask[] = [];

    // 从矛盾对拆解
    for (const c of analysis.contradictions) {
      tasks.push({
        id: `contra-${tasks.length}`,
        prompt: `针对问题 "${query}"，请从"${c.thesis}"的角度进行深入分析。`,
      });
      tasks.push({
        id: `contra-${tasks.length}`,
        prompt: `针对问题 "${query}"，请从"${c.antithesis}"的角度进行深入分析。`,
      });
    }

    // 从桥的公理拆解
    if (analysis.bridge && tasks.length === 0) {
      tasks.push({
        id: `bridge-${analysis.bridge.id}`,
        prompt: `基于"${analysis.bridge.axiom}"这一公理，分析问题: ${query}`,
      });
    }

    // 兜底: 按维度拆解
    if (tasks.length === 0) {
      tasks.push(
        { id: 'dim-0', prompt: `从技术实现角度分析: ${query}` },
        { id: 'dim-1', prompt: `从成本效益角度分析: ${query}` },
        { id: 'dim-2', prompt: `从风险评估角度分析: ${query}` },
      );
    }

    return tasks;
  }

  // ═══════════════════════════════════════════════════════════
  // 查询
  // ═══════════════════════════════════════════════════════════

  get mainAgent(): KunlunAgent { return this.main; }
  get workerCount(): number { return this.workers.length; }

  getStatus(): { main: { active: number }; workers: Array<{ id: string; active: number }> } {
    return {
      main: { active: this.main['_activeCount'] ?? 0 },
      workers: this.workers.map((w, i) => ({
        id: `worker-${i}`,
        active: (w as any)['_activeCount'] ?? 0,
      })),
    };
  }

  stop(): void {
    this.main.stop();
    for (const w of this.workers) w.stop();
    this.scheduler.stopGC();
    this.scheduler.reset();
  }
}

// ═══════════════════════════════════════════════════════════════
// 工厂
// ═══════════════════════════════════════════════════════════════

export async function createOrchestrator(
  options: KunlunAgentOptions,
  config?: KernelPoolConfig,
): Promise<MultiKernelOrchestrator> {
  const orch = new MultiKernelOrchestrator(options, config);
  await orch.start();
  return orch;
}

// ═══════════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════════

function extractText(msg: AssistantMessage): string {
  const content = (msg as any).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');
  }
  return JSON.stringify(content);
}
