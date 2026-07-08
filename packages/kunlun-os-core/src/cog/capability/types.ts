/**
 * CogCapability 类型定义 — 认知能力注册表接口
 *
 * 参考设计文档：认知能力注册机制
 */

// ═══════════════════════════════════════════════════════════════
// 认知能力核心类型
// ═══════════════════════════════════════════════════════════════

/**
 * 认知能力类型 — 对应认知循环的五个阶段
 */
export type CogCapabilityType = 'perceive' | 'think' | 'express' | 'act' | 'memorize';

/**
 * 能力状态
 */
export type CogCapabilityStatus = 'available' | 'busy' | 'degraded';

/**
 * 认知能力成本
 */
export interface CogCapabilityCost {
  /** 每次调用消耗的token数 */
  tokensPerCall: number;
  /** 平均延迟（毫秒） */
  avgLatencyMs: number;
}

/**
 * CogCapability — 单项认知能力描述
 */
export interface CogCapability {
  /** 能力类型 */
  type: CogCapabilityType;
  /** 提供者标识 */
  provider: string;
  /** 能力名称 */
  name: string;
  /** 能力版本 */
  version: string;
  /** 调用成本 */
  cost: CogCapabilityCost;
  /** 当前状态 */
  status: CogCapabilityStatus;
}

// ═══════════════════════════════════════════════════════════════
// 能力提供者接口
// ═══════════════════════════════════════════════════════════════

/**
 * CogCapabilityProvider — 认知能力提供者
 *
 * 一个提供者可注册多项认知能力
 */
export interface CogCapabilityProvider {
  /** 提供者唯一标识 */
  id: string;
  /** 提供的能力列表 */
  capabilities: CogCapability[];
  /** 注册回调 */
  register(): void;
  /** 心跳回调，用于保活 */
  heartbeat(): void;
  /** 注销回调 */
  unregister(): void;
}

// ═══════════════════════════════════════════════════════════════
// 查询过滤条件
// ═══════════════════════════════════════════════════════════════

/**
 * 能力查询过滤条件
 */
export interface CogCapabilityFilter {
  /** 最低版本要求 */
  minVersion?: string;
  /** 最大成本（tokensPerCall上限） */
  maxCost?: number;
}
