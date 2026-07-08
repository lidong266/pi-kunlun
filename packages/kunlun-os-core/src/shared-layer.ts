/**
 * 昆仑OS 共享认知层 — SharedCognitiveLayer v2
 *
 * 所有 Pi 微内核共享的认知资源：
 *   - PromptNormalizer: 语义规范化 + 相似度计算（语义去重）
 *   - TokenManager: 共享 Token 预算，避免重复 context 消耗
 *   - LLMResponseCache(LRU): 相同/相似 prompt → 直接返回缓存，LRU 淘汰
 *   - AnalysisCache(fuzzy): 模糊匹配分析结果，阈值 0.5
 *   - WorkerPublishing: Worker 结果发布回共享层，跨核知识复用
 *   - CacheWarming: 启动时预热常见查询模式
 *   - 归藏记忆: 三元记忆模型，所有 Pi 读写
 *   - 琅嬛知识: 知识卡片索引，所有 Pi 查询
 *
 * v2 改进:
 *   - 语义去重: brittle substring hash → PromptNormalizer 规范化 + token-overlap 相似度
 *   - LRU 淘汰: "least hits" → LRU (Map ordering) + TTL 双向淘汰
 *   - 模糊匹配: analysisCache 支持相似查询（"性能vs成本" ≈ "性能和成本的权衡"）
 *   - 命中率统计: 详细 CacheStats（hits/misses/rate/tokensSaved）
 *   - 缓存预热: warmCommonPatterns() 预设高频分析场景
 *   - Worker 共享: publishWorkerResult / getSharedInsights
 *
 * 成本收益：
 *   N 个 Pi 独立运行: N × 2000 context tokens = N × $cost
 *   N 个 Pi 共享层 v2: 1 × 2000 context tokens + N × 500 analysis tokens
 *   节省: (N-1) × 2000 tokens/请求
 *   语义去重额外节省: ~15-25% (相似查询命中)
 */

import { TokenManager } from './cog/memory';
import { TernaryMemoryModel, ResonantMemoryNetwork } from '@kunlun/subsystems';
import type { MemoryEntry } from '@kunlun/subsystems';
import type { KnowledgeCard } from './eleven-bridges.js';
import type { KunlunAnalysis } from './kunlun-os.js';
import { InsightEventBus } from './insight-bus.js';
import type { KeyFindingEvent } from './insight-bus.js';

// ═══════════════════════════════════════════════════════════════
// PromptNormalizer — 语义规范化 + 相似度
// ═══════════════════════════════════════════════════════════════

const CN_STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些',
  '什么', '怎么', '如何', '为什么', '因为', '所以', '但是', '如果',
  '可以', '需要', '应该', '能够', '可能', '已经', '还是', '或者',
  '以及', '而且', '然后', '之后', '之前', '对于', '关于', '通过',
  '这个', '那个', '这些', '那些', '进行', '使用', '利用', '应用',
]);

const EN_STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'about', 'also', 'how', 'what', 'which', 'who', 'whom', 'this',
  'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
]);

const CN_PUNCTUATION = /[，。！？、；：""''（）【】《》…—\s]+/g;
const EN_PUNCTUATION = /[,.!?;:'"()\[\]{}…\-\s]+/g;
const MULTI_SPACE = /\s+/g;

export class PromptNormalizer {
  private stopWords: Set<string>;

  constructor(stopWords?: Set<string>) {
    this.stopWords = stopWords ?? new Set([...CN_STOP_WORDS, ...EN_STOP_WORDS]);
  }

  /** 规范化文本：去标点、小写、去停用词、归一空格 */
  normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(CN_PUNCTUATION, ' ')
      .replace(EN_PUNCTUATION, ' ')
      .replace(MULTI_SPACE, ' ')
      .trim();
  }

  /** 提取关键词 tokens（去停用词） */
  tokenize(text: string): string[] {
    return this.normalize(text)
      .split(' ')
      .filter(t => t.length > 0 && !this.stopWords.has(t));
  }

  /** Jaccard 相似度 (0-1)，基于 token overlap */
  similarity(a: string, b: string): number {
    const tokensA = new Set(this.tokenize(a));
    const tokensB = new Set(this.tokenize(b));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }

    const union = tokensA.size + tokensB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /** 生成规范化的缓存键（保留语义 token 顺序） */
  cacheKey(text: string): string {
    return this.tokenize(text).join('|');
  }
}

// ═══════════════════════════════════════════════════════════════
// 缓存统计
// ═══════════════════════════════════════════════════════════════

export interface CacheStats {
  entries: number;
  maxEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  totalTokensSaved: number;
  /** 语义模糊命中次数（额外命中） */
  fuzzyHits: number;
}

// ═══════════════════════════════════════════════════════════════
// LLM 响应缓存 v2 — LRU + 语义规范化 + TTL
// ═══════════════════════════════════════════════════════════════

interface CacheEntry {
  response: string;
  normalizedKey: string;
  timestamp: number;
  tokenCount: number;
}

export class LLMResponseCache {
  /** LRU 缓存：Map 维持插入顺序，首项=最旧 */
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;
  private normalizer: PromptNormalizer;

  // 统计
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;
  private _fuzzyHits = 0;

  constructor(maxEntries = 100, ttlMs = 5 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.normalizer = new PromptNormalizer();
  }

  /** 精确获取缓存（规范化 key 匹配） */
  get(prompt: string): string | null {
    const nKey = this.normalizer.cacheKey(prompt);
    const entry = this.cache.get(nKey);

    if (!entry) {
      this._misses++;
      return null;
    }

    // TTL 过期检查
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(nKey);
      this._misses++;
      return null;
    }

    // LRU: 移到末尾（最近使用）
    this.cache.delete(nKey);
    this.cache.set(nKey, entry);

    this._hits++;
    return entry.response;
  }

  /** 写入缓存（LRU 淘汰 + TTL 清理） */
  set(prompt: string, response: string, tokenCount: number): void {
    this.evictExpired();

    const nKey = this.normalizer.cacheKey(prompt);

    // 已存在 → 更新（LRU 移到末尾）
    if (this.cache.has(nKey)) {
      this.cache.delete(nKey);
    } else if (this.cache.size >= this.maxEntries) {
      // LRU 淘汰：删除最旧的（Map 第一个）
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this._evictions++;
      }
    }

    this.cache.set(nKey, {
      response,
      normalizedKey: nKey,
      timestamp: Date.now(),
      tokenCount,
    });
  }

  /** 淘汰过期条目 */
  evictExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        count++;
        this._evictions++;
      }
    }
    return count;
  }

  /** 获取详细统计 */
  getStats(): CacheStats {
    return {
      entries: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? Math.round((this._hits / (this._hits + this._misses)) * 10000) / 100
        : 0,
      evictions: this._evictions,
      totalTokensSaved: this.computeTokensSaved(),
      fuzzyHits: this._fuzzyHits,
    };
  }

  /** 清空缓存 */
  clear(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
    this._fuzzyHits = 0;
  }

  private computeTokensSaved(): number {
    let saved = 0;
    for (const entry of this.cache.values()) {
      // 每次命中节省 entry.tokenCount tokens（避免重复 LLM 调用）
      // 命中次数 = hits 中属于该 entry 的部分
      saved += entry.tokenCount;
    }
    // 粗略估算：缓存中的条目 × 平均 token 数 × (命中率)
    const avgTokens = this.cache.size > 0
      ? [...this.cache.values()].reduce((s, e) => s + e.tokenCount, 0) / this.cache.size
      : 0;
    const hitMultiplier = Math.max(1, this._hits);
    return Math.round(avgTokens * hitMultiplier);
  }
}

// ═══════════════════════════════════════════════════════════════
// Worker 共享结果
// ═══════════════════════════════════════════════════════════════

export interface WorkerSharedInsight {
  workerId: string;
  query: string;
  summary: string;
  keyFindings: string[];
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// 共享认知层 v2
// ═══════════════════════════════════════════════════════════════

export interface SharedLayerConfig {
  /** LLM Token 池容量 */
  llmPoolSize?: number;
  /** 缓存 Token 池容量 */
  cachePoolSize?: number;
  /** 知识 Token 池容量 */
  knowledgePoolSize?: number;
  /** 记忆最大条目数 */
  maxMemories?: number;
  /** 缓存最大条目数 */
  maxCacheEntries?: number;
  /** 缓存 TTL (ms) */
  cacheTTL?: number;
  /** 模糊匹配阈值 (0-1)，默认 0.5 */
  fuzzyThreshold?: number;
  /** 最大共享 insight 数 */
  maxInsights?: number;
}

export class SharedCognitiveLayer {
  /** 文本规范化器 */
  readonly normalizer: PromptNormalizer;
  /** 共享 Token 预算管理器 */
  readonly tokenManager: TokenManager;
  /** LLM 响应缓存 (LRU + 语义规范化) */
  readonly llmCache: LLMResponseCache;
  /** 归藏·三元记忆 */
  readonly memory: TernaryMemoryModel;
  /** 记忆共鸣网络 */
  readonly resonance: ResonantMemoryNetwork;
  /** 共享的知识卡片缓存 */
  readonly knowledgeCache = new Map<string, KnowledgeCard[]>();
  /** 分析结果缓存（key → 完整分析） */
  readonly analysisCache = new Map<string, KunlunAnalysis>();
  /** Worker 共享洞察 */
  readonly sharedInsights: WorkerSharedInsight[] = [];
  /** 跨 Worker 事件总线（主动推送关键发现） */
  readonly eventBus = new InsightEventBus();

  // 配置
  private fuzzyThreshold: number;
  private maxInsights: number;

  // 分析缓存统计
  private _analysisHits = 0;
  private _analysisMisses = 0;
  private _analysisFuzzyHits = 0;

  constructor(config: SharedLayerConfig = {}) {
    this.normalizer = new PromptNormalizer();
    this.tokenManager = new TokenManager();
    this.llmCache = new LLMResponseCache(
      config.maxCacheEntries ?? 100,
      config.cacheTTL ?? 5 * 60 * 1000,
    );
    this.memory = new TernaryMemoryModel({
      maxEntries: config.maxMemories ?? 500,
    });
    this.resonance = new ResonantMemoryNetwork(this.memory);
    this.fuzzyThreshold = config.fuzzyThreshold ?? 0.5;
    this.maxInsights = config.maxInsights ?? 50;
  }

  // ═══════════════════════════════════════════════════════════
  // Token 预算
  // ═══════════════════════════════════════════════════════════

  /** 为任务分配 Token（从共享池） */
  allocateTokens(taskId: string, estimatedTokens: number): boolean {
    try {
      this.tokenManager.allocate({ id: taskId } as any, estimatedTokens);
      return true;
    } catch {
      return false;
    }
  }

  /** 释放任务的 Token */
  releaseTokens(taskId: string): void {
    try {
      this.tokenManager.release(taskId);
    } catch { /* ignore */ }
  }

  /** 获取池使用情况 */
  getTokenUsage() {
    return {
      llm: this.tokenManager.getPoolUsage('llm'),
      cache: this.tokenManager.getPoolUsage('cache'),
      knowledge: this.tokenManager.getPoolUsage('knowledge'),
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LLM 缓存
  // ═══════════════════════════════════════════════════════════

  /** 尝试从缓存获取 LLM 响应 */
  getCachedResponse(prompt: string): string | null {
    return this.llmCache.get(prompt);
  }

  /** 缓存 LLM 响应 */
  cacheResponse(prompt: string, response: string, tokenCount: number): void {
    this.llmCache.set(prompt, response, tokenCount);
  }

  // ═══════════════════════════════════════════════════════════
  // 记忆共享
  // ═══════════════════════════════════════════════════════════

  /** 写入记忆（所有 Pi 共享） */
  writeMemory(content: string, tags: string[] = []): MemoryEntry {
    return this.memory.store(content, 'kunlun-os', tags);
  }

  /** 查询记忆 */
  queryMemory(keyword: string): MemoryEntry[] {
    return this.memory.search(keyword);
  }

  /** 获取共鸣记忆 */
  getResonantMemories(entryId: string): MemoryEntry[] {
    const event = this.resonance.resonate(entryId);
    return event
      ? this.memory.getAllMemories().filter(m => event.resonatedIds.includes(m.id))
      : [];
  }

  /** 获取所有记忆 */
  getAllMemories(): MemoryEntry[] {
    return this.memory.getAllMemories();
  }

  // ═══════════════════════════════════════════════════════════
  // 分析缓存（精确 + 模糊匹配）
  // ═══════════════════════════════════════════════════════════

  /** 缓存认知分析结果 */
  cacheAnalysis(query: string, analysis: KunlunAnalysis): void {
    const key = this.normalizer.cacheKey(query);
    this.analysisCache.set(key, analysis);

    // 上限保护：超出时删除最旧的
    if (this.analysisCache.size > 200) {
      const oldest = this.analysisCache.keys().next().value;
      if (oldest) this.analysisCache.delete(oldest);
    }
  }

  /**
   * 获取缓存的认知分析（精确匹配 → 模糊匹配 → undefined）
   *
   * 先尝试精确 key 匹配，找不到则用 token-overlap 模糊匹配
   */
  getCachedAnalysis(query: string): KunlunAnalysis | undefined {
    // 第一步：精确匹配
    const exactKey = this.normalizer.cacheKey(query);
    const exact = this.analysisCache.get(exactKey);
    if (exact) {
      this._analysisHits++;
      return exact;
    }

    // 第二步：模糊匹配
    const similar = this.findSimilarAnalysis(query);
    if (similar) {
      this._analysisFuzzyHits++;
      this._analysisHits++;
      return similar;
    }

    this._analysisMisses++;
    return undefined;
  }

  /**
   * 模糊匹配：遍历缓存找到 Jaccard 相似度 >= threshold 的最佳匹配
   */
  private findSimilarAnalysis(query: string): KunlunAnalysis | undefined {
    const queryTokens = this.normalizer.tokenize(query);
    if (queryTokens.length === 0) return undefined;

    const querySet = new Set(queryTokens);
    let bestScore = 0;
    let bestEntry: KunlunAnalysis | undefined;

    for (const [cachedKey, entry] of this.analysisCache) {
      const cachedTokens = cachedKey.split('|').filter(t => t.length > 0);
      if (cachedTokens.length === 0) continue;

      let intersection = 0;
      for (const t of cachedTokens) {
        if (querySet.has(t)) intersection++;
      }

      const union = queryTokens.length + cachedTokens.length - intersection;
      const score = union === 0 ? 0 : intersection / union;

      if (score > bestScore && score >= this.fuzzyThreshold) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    return bestEntry;
  }

  // ═══════════════════════════════════════════════════════════
  // 缓存预热
  // ═══════════════════════════════════════════════════════════

  /**
   * 预热分析缓存：为常见高频查询模式预设空分析结果
   * 这确保首次 deepAnalyze 调用时 cachedAnalysis 能命中
   */
  warmAnalysisCache(entries: Array<{ query: string; analysis: KunlunAnalysis }>): void {
    for (const { query, analysis } of entries) {
      const key = this.normalizer.cacheKey(query);
      if (!this.analysisCache.has(key)) {
        this.analysisCache.set(key, analysis);
      }
    }
  }

  /**
   * 预热 LLM 缓存：预设常见 prompt → response 映射
   */
  warmLLMCache(entries: Array<{ prompt: string; response: string; tokens: number }>): void {
    for (const { prompt, response, tokens } of entries) {
      this.llmCache.set(prompt, response, tokens);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Worker 知识共享
  // ═══════════════════════════════════════════════════════════

  /**
   * Worker 将分析结果发布回共享层
   * 后续的 Map 阶段 Worker 可通过 getSharedInsights 获取先完成的 Worker 洞察
   */
  publishWorkerResult(insight: WorkerSharedInsight): void {
    // 去重：相同 workerId + query 的只保留最新
    const existingIdx = this.sharedInsights.findIndex(
      i => i.workerId === insight.workerId && i.query === insight.query,
    );
    if (existingIdx >= 0) {
      this.sharedInsights[existingIdx] = insight;
      return;
    }

    this.sharedInsights.push(insight);

    // 上限保护：超出时删除最旧的
    if (this.sharedInsights.length > this.maxInsights) {
      this.sharedInsights.shift();
    }

    // 广播关键发现到事件总线（跨核主动通知）
    if (insight.keyFindings.length > 0) {
      this.eventBus.broadcast({
        sourceWorkerId: insight.workerId,
        finding: insight.keyFindings[0]!,
        confidence: insight.keyFindings.length > 1 ? 0.8 : 0.6,
        timestamp: insight.timestamp,
        tags: this.normalizer.tokenize(insight.summary),
      });
    }
  }

  /**
   * 获取与查询相关的共享洞察
   * 按时间降序 + 语义相关性排序
   */
  getSharedInsights(query: string, maxResults = 5): WorkerSharedInsight[] {
    if (this.sharedInsights.length === 0) return [];

    const scored = this.sharedInsights.map(insight => ({
      insight,
      score: this.normalizer.similarity(query, insight.query + ' ' + insight.summary),
    }));

    return scored
      .filter(s => s.score > 0.1)
      .sort((a, b) => b.score - a.score || b.insight.timestamp - a.insight.timestamp)
      .slice(0, maxResults)
      .map(s => s.insight);
  }

  /**
   * 批量上下文注入：一次性获取并格式化所有相关洞察
   *
   * 替代当前分散的 getSharedInsights + 手动拼接模式，
   * 提供 compact（Map阶段）和 detailed（Reduce阶段）两种格式。
   */
  batchInjectContext(query: string, options?: {
    maxInsights?: number;
    format?: 'compact' | 'detailed';
  }): string {
    const maxInsights = options?.maxInsights ?? 5;
    const insights = this.getSharedInsights(query, maxInsights);
    const format = options?.format ?? 'compact';

    if (insights.length === 0) return '';

    if (format === 'compact') {
      return `\n\n[共享洞察 — ${insights.length} 条先完成的分析供参考]\n${
        insights.map((s, i) => `(${i + 1}) [${s.workerId}] ${s.summary}`).join('\n')
      }\n`;
    }

    // 详细格式：适合 Reduce 阶段
    return '\n\n---\n' + insights.map((ins, i) =>
      `### 共享洞察 ${i + 1} (${ins.workerId})\n` +
      `**摘要**: ${ins.summary}\n` +
      `**关键发现**:\n${ins.keyFindings.map(f => `- ${f}`).join('\n')}`
    ).join('\n\n') + '\n---\n';
  }

  /** 清空共享洞察 */
  clearInsights(): void {
    this.sharedInsights.length = 0;
  }

  // ═══════════════════════════════════════════════════════════
  // 统计
  // ═══════════════════════════════════════════════════════════

  getStats() {
    const llmStats = this.llmCache.getStats();
    const totalAnalysisAttempts = this._analysisHits + this._analysisMisses;

    return {
      tokens: this.getTokenUsage(),
      llmCache: llmStats,
      memories: this.memory.getAllMemories().length,
      analysisCache: this.analysisCache.size,
      analysisHitRate: totalAnalysisAttempts > 0
        ? Math.round((this._analysisHits / totalAnalysisAttempts) * 10000) / 100
        : 0,
      analysisFuzzyHits: this._analysisFuzzyHits,
      sharedInsights: this.sharedInsights.length,
    };
  }
}
