/**
 * — 认知能力注册表
 *
 * 统一认知能力的注册、发现和生命周期管理
 */

// ─── 类型 ───
export type {
  CogCapabilityType,
  CogCapabilityStatus,
  CogCapabilityCost,
  CogCapability,
  CogCapabilityProvider,
  CogCapabilityFilter,
} from './types';

// ─── 注册中心 ───
export { CogCapabilityRegistry } from './registry';

// ─── 辅助函数 ───

import { CogCapabilityRegistry } from './registry';
import type { CogCapabilityProvider } from './types';

/**
 * 创建认知能力注册中心
 */
export function createCapabilityRegistry(): CogCapabilityRegistry {
  return new CogCapabilityRegistry();
}

/**
 * 注册能力提供者到注册中心
 */
export function registerProvider(
  registry: CogCapabilityRegistry,
  provider: CogCapabilityProvider,
): void {
  registry.register(provider);
}
