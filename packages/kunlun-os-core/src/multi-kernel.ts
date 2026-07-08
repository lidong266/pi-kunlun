/**
 * KunlunOS 多微内核调度器 v4 — MapReduce 认知并行 + 并发控制 + 流式Reduce
 *
 * 核心思路：一个任务拆成 N 个子任务，N 个 Pi 并行执行，主 Pi 汇总。
 *
 *   用户: "分析这个项目，从技术、商业、风险三个角度"
 *     │
 *     ├─ 主 Pi (Map 阶段): injectCognition 拆解 → 3 个子任务
 *     │   ├─ Pi-1: "从技术角度分析这个项目" ─┐
 *     │   ├─ Pi-2: "从商业角度分析这个项目" ─┤ 受控并发(信号量)
 *     │   └─ Pi-3: "从风险角度分析这个项目" ─┘
 *     │
 *     └─ 主 Pi (Reduce 阶段): 收集 3 个结果 → 综合集成 → 输出
 *
 * 共享层（所有 Pi 共享）:
 *   - TokenManager: 共享 Token 预算，避免重复消耗
 *   - Session: 共享上下文，子 Pi 的结果写入主 Pi 的 session
 *   - 认知引擎: injectCognition 共用（纯本地，不需要 Pi）
 *
 * v4 改进:
 *   - 并发控制: ConcurrencyController Promise信号量，防止LLM过载
 *   - 流式Reduce: partialReduce模式 — 先完成Worker的结果立即注入共享层
 *     后续Worker的prompt自动包含已完成的洞察，实现跨核知识传递
 */

import { CogScheduler, CogMultiInstanceManager, CogPriority } from './cog/kal';
import { KunlunAgent } from './kunlun-agent.js';
import type { KunlunAgentOptions } from './kunlun-agent.js';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { KunlunAnalysis } from './kunlun-os.js';
import { SharedCognitiveLayer } from './shared-layer.js';
import type { SharedLayerConfig } from './shared-layer.js';
import { CognitivePrefetcher, StreamReduceCollector, ConcurrencyController } from './optimizations.js';

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
  /** 最大并发 LLM 请求数（默认 = workers 数量，设为更大可让更多子任务排队） */
  maxConcurrency?: number;
}

export interface MapReduceOptions {
  /** 最大并发 LLM 请求数（默认 = workers 数量） */
  maxConcurrency?: number;
  /**
   * 是否启用流式增量 Reduce
   * - 开启后，先完成的 Worker 结果会立即发布到共享层
   * - 后续 Worker 的 prompt 会自动包含已完成的洞察
   * - 跨核知识传递，提升整体分析质量
   */
  partialReduce?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// MultiKernelOrchestrator v4
// ═══════════════════════════════════════════════════════════════

export class MultiKernelOrchestrator {
  private scheduler: CogScheduler;
  private multiInstance: CogMultiInstanceManager;
  /** 共享认知层（所有 Pi 共享 Token/缓存/记忆） */
  readonly shared: SharedCognitiveLayer;
  /** 认知预取器 */
  private prefetcher: CognitivePrefetcher;
  /** 主 Pi */
  private main: KunlunAgent;
  /** 工作 Pi 池 */
  private workers: KunlunAgent[] = [];
  private config: Required<KernelPoolConfig>;

  constructor(options: KunlunAgentOptions, config: KernelPoolConfig = {}, sharedConfig?: SharedLayerConfig) {
    this.config = {
      workers: config.workers ?? 3,
      shareSession: config.shareSession ?? true,
      maxConcurrency: config.maxConcurrency ?? config.workers ?? 3,
    };
    this.scheduler = new CogScheduler();
    this.multiInstance = new CogMultiInstanceManager(this.scheduler);
    this.shared = new SharedCognitiveLayer(sharedConfig);
    this.prefetcher = new CognitivePrefetcher(this.shared);
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
   *
   * @param options.partialReduce 启用流式增量Reduce — 先完成Worker的结果立即注入共享层，
   *   后续Worker的prompt自动包含已完成洞察，实现跨核知识传递
   * @param options.maxConcurrency 最大并发LLM请求数，默认=workers数量
   */
  async mapReduce(
    /** 用户原始问题 */
    query: string,
    /** 子任务列表（由 injectCognition 或外部提供） */
    subTasks: SubTask[],
    /** 汇总时的 system prompt */
    reducePrompt?: string,
    /** v4 新增选项 */
    options?: MapReduceOptions,
  ): Promise<{
    /** 每个子任务的结果 */
    subResults: SubTaskResult[];
    /** 汇总后的最终回复 */
    finalReply: AssistantMessage;
    /** 总耗时 (ms) */
    elapsed: number;
    /** v4 并发统计 */
    concurrencyStats?: { max: number; peak: number; avgWaiters: number };
  }> {
    const startTime = Date.now();
    const partialReduce = options?.partialReduce ?? true; // 默认开启流式Reduce
    const maxConcurrency = options?.maxConcurrency ?? this.config.workers;
    const concurrency = new ConcurrencyController(maxConcurrency);

    // 生成预取注入文本（从 shared 层获取）
    const cachedAnalysis = this.shared.getCachedAnalysis(query);
    const prefetchInjection = cachedAnalysis
      ? this.prefetcher.formatPrefetchPrompt(
          this.prefetcher.buildPrefetchContext(query, cachedAnalysis)
        )
      : '';

    // ── Map 阶段: N个Pi受控并发，流式注入共享洞察 ──
    const collector = new StreamReduceCollector(subTasks.length);

    // 流式增量Reduce：Worker完成 → 立即发布到共享层 → 后续Worker可见
    let concurrencyPeak = 0;
    let waitersTotal = 0;
    let waitersSamples = 0;

    collector.setPartialResultCallback((_done, _total, resultText, index) => {
      // 每完成一个Worker，立即发布洞察到共享层
      this.shared.publishWorkerResult({
        workerId: `worker-${index}`,
        query: subTasks[index]!.prompt,
        summary: resultText.slice(0, 200),
        keyFindings: extractKeyFindings(resultText, 3),
        timestamp: Date.now(),
      });

      // 记录并发峰值
      concurrencyPeak = Math.max(concurrencyPeak, concurrency.active + concurrency.waiting);
      waitersTotal += concurrency.waiting;
      waitersSamples++;
    });

    const subResults = await Promise.all(
      subTasks.map(async (task, index) => {
        // 获取并发槽位（信号量控制）
        await concurrency.acquire();

        try {
          const worker = this.workers[index % this.workers.length]!;

          // partialReduce: 用 batchInjectContext 统一获取+格式化已完成Worker洞察
          const insightsInjection = partialReduce
            ? this.shared.batchInjectContext(task.prompt, { maxInsights: 2 })
            : '';

          // 构建增强 prompt：预取上下文 + 流式共享洞察
          const parts = [
            task.systemPrompt,
            prefetchInjection,
            insightsInjection,
            `\n问题: ${task.prompt}`,
          ];
          const enhancedPrompt = parts.filter(Boolean).join('\n');

          const result = await worker.harness.prompt(enhancedPrompt);
          const analysis = worker.getLatestAnalysis();
          const resultText = extractText(result);

          collector.collect(index, resultText);

          const sr: SubTaskResult = { taskId: task.id, result, analysis: analysis ?? undefined };
          return sr;
        } finally {
          concurrency.release();
        }
      })
    );

    // ── Reduce 阶段: 主Pi综合 ──
    const allResults = await collector.waitAll();
    const subResultsText = allResults
      .map((text, i) => `### 子任务${i + 1}: ${subTasks[i]!.prompt}\n${text}`)
      .join('\n\n');

    // 注入共享洞察：用 batchInjectContext 统一格式化
    const insightsText = this.shared.batchInjectContext(query, {
      maxInsights: 3,
      format: 'detailed',
    });

    const reduceInput = reducePrompt
      ? `${reducePrompt}\n\n${insightsText}${subResultsText}`
      : `以下是 ${subResults.length} 个子任务的分析结果，请综合这些结果给出最终回答。\n\n原始问题: ${query}\n${insightsText}\n${subResultsText}`;

    const finalReply = await this.main.harness.prompt(reduceInput);

    return {
      subResults,
      finalReply,
      elapsed: Date.now() - startTime,
      concurrencyStats: {
        max: maxConcurrency,
        peak: concurrencyPeak,
        avgWaiters: waitersSamples > 0 ? Math.round((waitersTotal / waitersSamples) * 100) / 100 : 0,
      },
    };
  }

  /**
   * 一键深度分析: LLM智能拆解 + 多Pi并行 + 综合集成
   *
   * 这是最常用的入口——用户只需提出问题，
   * 昆仑OS 自动做认知分析 → LLM智能拆解 → 多Pi并行 → 综合集成。
   */
  async deepAnalyze(query: string): Promise<{
    analysis: KunlunAnalysis;
    subTasks: SubTask[];
    mapReduceResult: Awaited<ReturnType<typeof this.mapReduce>>;
    fromCache: boolean;
  }> {
    // 第一步: 认知分析 (纯本地 ~20ms)
    const cachedAnalysis = this.shared.getCachedAnalysis(query);
    const analysis = cachedAnalysis ?? await this.main.os.injectCognition(
      [{ role: 'user', content: query }], ''
    );

    if (!cachedAnalysis) {
      this.shared.cacheAnalysis(query, analysis);
    }

    // 第二步: LLM 智能拆解
    // 让 LLM 分析问题结构，拆成 N 个可并行的子任务
    const subTasks = await this.decomposeWithLLM(query, analysis);

    // 第三步: MapReduce 并行执行
    const mrResult = await this.mapReduce(query, subTasks);

    // 第四步: 写入共享记忆
    this.shared.writeMemory(
      `分析: ${query} → ${analysis.summary} (${subTasks.length}子任务并行)`,
      analysis.knowledgeCards?.map(c => c.id) ?? [],
    );

    return { analysis, subTasks, mapReduceResult: mrResult, fromCache: !!cachedAnalysis };
  }

  // ═══════════════════════════════════════════════════════════
  // LLM 智能拆解
  // ═══════════════════════════════════════════════════════════

  /**
   * 用 LLM 将复杂问题拆解为可并行的子任务
   *
   * 输入: 用户问题 + 认知分析结果
   * 输出: 结构化的子任务列表
   */
  private async decomposeWithLLM(query: string, analysis: KunlunAnalysis): Promise<SubTask[]> {
    // 构建拆解 prompt：把认知分析结果作为上下文
    const decomposePrompt = [
      '你是一个任务拆解专家。请将以下问题拆解为多个可并行执行的子任务。',
      '',
      `原始问题: ${query}`,
      '',
      analysis.bridge
        ? `学科桥: ${analysis.bridge.icon} ${analysis.bridge.name} — ${analysis.bridge.axiom}`
        : '',
      analysis.contradictions.length > 0
        ? `检测到的矛盾:\n${analysis.contradictions.map(c => `  · ${c.thesis} ↔ ${c.antithesis}`).join('\n')}`
        : '',
      analysis.strategy ? `策略: ${analysis.strategy}` : '',
      '',
      '要求:',
      '1. 每个子任务必须是独立可并行执行的',
      '2. 子任务数量2-5个，不宜过多',
      '3. 每个子任务的 prompt 必须自包含（含完整上下文）',
      '4. 输出JSON格式: {"subtasks":[{"prompt":"..."},{"prompt":"..."}]}',
      '',
      '请输出JSON:',
    ].filter(Boolean).join('\n');

    try {
      // 调用 LLM 拆解
      const llmResponse = await this.main.harness.prompt(decomposePrompt);
      const text = extractText(llmResponse);

      // 解析 JSON
      const jsonMatch = text.match(/\{[\s\S]*"subtasks"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.subtasks && Array.isArray(parsed.subtasks)) {
          return parsed.subtasks.map((t: any, i: number) => ({
            id: `llm-${i}`,
            prompt: t.prompt,
            systemPrompt: t.systemPrompt,
          }));
        }
      }
    } catch {
      // LLM 拆解失败 → 降级到规则拆解
    }

    // 降级: 规则拆解
    return this.decomposeFromAnalysis(query, analysis);
  }

  /**
   * 规则拆解（LLM不可用时的降级方案）
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

    // 兜底
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

/** 从文本中提取关键发现（句式拆分） */
function extractKeyFindings(text: string, maxCount = 3): string[] {
  const lines = text
    .split(/[。！？\n]/)
    .map(l => l.trim())
    .filter(l => l.length > 15 && l.length < 200);

  // 优先取包含"关键"、"核心"、"重要"、"发现"、"结论"的行
  const priority = lines.filter(l =>
    /关键|核心|重要|发现|结论|总结|本质/.test(l)
  );
  const rest = lines.filter(l => !/关键|核心|重要|发现|结论|总结|本质/.test(l));

  return [...priority, ...rest].slice(0, maxCount);
}
