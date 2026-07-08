/**
 * CogCapabilityRegistry — 认知能力注册中心
 *
 * 管理认知能力提供者的注册、查询、心跳和注销
 * 参考设计文档
 */

import type {
  CogCapability,
  CogCapabilityProvider,
  CogCapabilityType,
  CogCapabilityFilter,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 版本比较工具
// ═══════════════════════════════════════════════════════════════

/**
 * 比较两个语义化版本号
 * @returns 负数表示 a < b，0 表示相等，正数表示 a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((p) => Number.parseInt(p, 10));
  const partsB = b.split('.').map((p) => Number.parseInt(p, 10));
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va !== vb) {
      return va - vb;
    }
  }
  return 0;
}

// ═══════════════════════════════════════════════════════════════
// CogCapabilityRegistry
// ═══════════════════════════════════════════════════════════════

export class CogCapabilityRegistry {
  private providers: Map<string, CogCapabilityProvider> = new Map();

  /**
   * 注册一个能力提供者
   */
  register(provider: CogCapabilityProvider): void {
    this.providers.set(provider.id, provider);
    provider.register();
  }

  /**
   * 按类型查找能力，可选过滤条件
   */
  find(type: CogCapabilityType, filter?: CogCapabilityFilter): CogCapability[] {
    const results: CogCapability[] = [];
    for (const provider of this.providers.values()) {
      for (const cap of provider.capabilities) {
        if (cap.type !== type) {
          continue;
        }
        if (filter?.minVersion !== undefined) {
          if (compareVersions(cap.version, filter.minVersion) < 0) {
            continue;
          }
        }
        if (filter?.maxCost !== undefined) {
          if (cap.cost.tokensPerCall > filter.maxCost) {
            continue;
          }
        }
        results.push(cap);
      }
    }
    return results;
  }

  /**
   * 获取指定提供者的所有能力
   */
  getByProvider(providerId: string): CogCapability[] {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return [];
    }
    return [...provider.capabilities];
  }

  /**
   * 注销提供者
   */
  unregister(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.unregister();
      this.providers.delete(providerId);
    }
  }

  /**
   * 列出所有已注册能力
   */
  listAll(): CogCapability[] {
    const results: CogCapability[] = [];
    for (const provider of this.providers.values()) {
      results.push(...provider.capabilities);
    }
    return results;
  }

  /**
   * 获取已注册提供者数量
   */
  getProviderCount(): number {
    return this.providers.size;
  }
}
