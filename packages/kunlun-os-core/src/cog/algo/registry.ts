/**
 * CogAlgorithmRegistry — 算法Plugin注册中心
 *
 * 会话隔离：每个sessionId独立的算法实例Map
 * 参考设计文档
 */

import type { ICogAlgorithm, AlgorithmFactory, AlgorithmContext } from './types';
import { ContradictionPlugin } from './plugins/contradiction-plugin';
import { PracticePlugin } from './plugins/practice-plugin';
import { ProtractedWarPlugin } from './plugins/protracted-war-plugin';
import { OCGSPlugin } from './plugins/ocgs-plugin';

// ═══════════════════════════════════════════════════════════════
// CogAlgorithmRegistry
// ═══════════════════════════════════════════════════════════════

export class CogAlgorithmRegistry {
  private factories: Map<string, AlgorithmFactory> = new Map();
  private sessionInstances: Map<string, Map<string, ICogAlgorithm>> = new Map();

  register(name: string, factory: AlgorithmFactory): void {
    this.factories.set(name, factory);
  }

  async getAlgorithm(sessionId: string, name: string): Promise<ICogAlgorithm> {
    if (!this.factories.has(name)) {
      throw new Error(`Algorithm "${name}" not registered`);
    }

    // 确保会话实例Map存在
    if (!this.sessionInstances.has(sessionId)) {
      this.sessionInstances.set(sessionId, new Map());
    }
    const instances = this.sessionInstances.get(sessionId)!;

    // 如果会话中已有实例则返回
    if (instances.has(name)) {
      return instances.get(name)!;
    }

    // 创建新实例并准备
    const factory = this.factories.get(name)!;
    const algorithm = factory();
    const ctx: AlgorithmContext = {
      createdAt: Date.now(),
      metadata: { sessionId },
    };
    await algorithm.prepare(sessionId, ctx);
    instances.set(name, algorithm);

    return algorithm;
  }

  async releaseSession(sessionId: string): Promise<void> {
    const instances = this.sessionInstances.get(sessionId);
    if (instances) {
      for (const [name, algorithm] of instances.entries()) {
        await algorithm.release(sessionId);
      }
      this.sessionInstances.delete(sessionId);
    }
  }

  initDefault(): void {
    this.register('contradiction', () => new ContradictionPlugin());
    this.register('practice', () => new PracticePlugin());
    this.register('protracted-war', () => new ProtractedWarPlugin());
    this.register('ocgs', () => new OCGSPlugin());
  }

  listAlgorithms(): string[] {
    return Array.from(this.factories.keys());
  }
}
