/**
 * 昆仑OS 共享认知层 — SharedCognitiveLayer
 *
 * 所有 Pi 微内核共享的认知资源：
 *   - TokenManager: 共享 Token 预算，避免重复 context 消耗
 *   - LLM 响应缓存: 相同 prompt → 直接返回缓存，节省 API 费用
 *   - 归藏记忆: 三元记忆模型，所有 Pi 读写
 *   - 琅嬛知识: 知识卡片索引，所有 Pi 查询
 *
 * 成本收益：
 *   N 个 Pi 独立运行: N × 2000 context tokens = N × $cost
 *   N 个 Pi 共享层:    1 × 2000 context tokens + N × 500 analysis tokens
 *   节省: (N-1) × 2000 tokens/请求
 */

import { TokenManager } from '@kunlun/cog-memory';
import { TernaryMemoryModel, ResonantMemoryNetwork } from '@kunlun/subsystems';
import type { MemoryEntry } from '@kunlun/subsystems';
import type { KnowledgeCard } from './eleven-bridges.js';
import type { KunlunAnalysis } from './kunlun-os.js';

// ═══════════════════════════════════════════════════════════════
// LLM 响应缓存
// ═══════════════════════════════════════════════════════════════

interface CacheEntry {
  response: string;
  timestamp: number;
  tokenCount: number;
  hitCount: number;
}

export class LLMResponseCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 100, ttlMs = 5 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /** 获取缓存 */
  get(prompt: string): string | null {
    const key = this.hashKey(prompt);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    entry.hitCount++;
    return entry.response;
  }

  /** 写入缓存 */
  set(prompt: string, response: string, tokenCount: number): void {
    if (this.cache.size >= this.maxEntries) {
      // 淘汰最少命中的
      let minKey = '';
      let minHits = Infinity;
      for (const [k, v] of this.cache) {
        if (v.hitCount < minHits) { minHits = v.hitCount; minKey = k; }
      }
      this.cache.delete(minKey);
    }
    this.cache.set(this.hashKey(prompt), {
      response, timestamp: Date.now(), tokenCount, hitCount: 1,
    });
  }

  getStats() {
    let totalTokens = 0;
    let totalHits = 0;
    for (const v of this.cache.values()) {
      totalTokens += v.tokenCount;
      totalHits += v.hitCount;
    }
    return {
      entries: this.cache.size,
      totalTokensSaved: totalTokens * (totalHits - 1), // 节省的 tokens
      totalHits,
    };
  }

  private hashKey(prompt: string): string {
    // 简单哈希：取前100字符 + 长度
    return `${prompt.substring(0, 100)}_${prompt.length}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// 共享认知层
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
}

export class SharedCognitiveLayer {
  /** 共享 Token 预算管理器 */
  readonly tokenManager: TokenManager;
  /** LLM 响应缓存 */
  readonly llmCache: LLMResponseCache;
  /** 归藏·三元记忆 */
  readonly memory: TernaryMemoryModel;
  /** 记忆共鸣网络 */
  readonly resonance: ResonantMemoryNetwork;
  /** 共享的知识卡片缓存 */
  readonly knowledgeCache = new Map<string, KnowledgeCard[]>();
  /** 分析结果缓存 */
  readonly analysisCache = new Map<string, KunlunAnalysis>();

  constructor(config: SharedLayerConfig = {}) {
    this.tokenManager = new TokenManager();
    this.llmCache = new LLMResponseCache(
      config.maxCacheEntries ?? 100,
      config.cacheTTL ?? 5 * 60 * 1000,
    );
    this.memory = new TernaryMemoryModel({
      maxEntries: config.maxMemories ?? 500,
    });
    this.resonance = new ResonantMemoryNetwork(this.memory);
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
  writeMemory(content: string, associations: string[] = []): MemoryEntry {
    return this.memory.add({
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      ternaryState: 1,
      strength: 1,
      decayRate: 0.01,
      associations,
      createdAt: Date.now(),
      lastReinforced: Date.now(),
    });
  }

  /** 查询记忆 */
  queryMemory(keyword: string, limit = 5): MemoryEntry[] {
    return this.memory.search(keyword, limit);
  }

  /** 获取共鸣记忆 */
  getResonantMemories(entryId: string): MemoryEntry[] {
    return this.resonance.getResonant(entryId);
  }

  // ═══════════════════════════════════════════════════════════
  // 分析缓存
  // ═══════════════════════════════════════════════════════════

  /** 缓存认知分析结果 */
  cacheAnalysis(query: string, analysis: KunlunAnalysis): void {
    this.analysisCache.set(this.normalizeKey(query), analysis);
  }

  /** 获取缓存的认知分析 */
  getCachedAnalysis(query: string): KunlunAnalysis | undefined {
    return this.analysisCache.get(this.normalizeKey(query));
  }

  // ═══════════════════════════════════════════════════════════
  // 统计
  // ═══════════════════════════════════════════════════════════

  getStats() {
    return {
      tokens: this.getTokenUsage(),
      cache: this.llmCache.getStats(),
      memories: this.memory.count(),
      analysisCache: this.analysisCache.size,
    };
  }

  private normalizeKey(s: string): string {
    return s.substring(0, 80).toLowerCase().replace(/\s+/g, ' ');
  }
}
