/**
 * — 四大算法Plugin注册机制
 *
 * 统一算法插件注册、会话隔离、生命周期管理
 */

// ─── 类型 ───
export type {
  ICogAlgorithm,
  AlgorithmFactory,
  AlgorithmContext,
  AnalysisRequest,
  AnalysisResponse,
  IterationRequest,
  IterationState,
  IterationResponse,
  InferMode,
} from './types';

// ─── 注册中心 ───
export { CogAlgorithmRegistry } from './registry';

// ─── 内置Plugin ───
export { ContradictionPlugin } from './plugins/contradiction-plugin';
export { PracticePlugin } from './plugins/practice-plugin';
export { ProtractedWarPlugin } from './plugins/protracted-war-plugin';
export { OCGSPlugin } from './plugins/ocgs-plugin';

// ─── 辅助函数 ───

import { CogAlgorithmRegistry } from './registry';
import type { ICogAlgorithm, AlgorithmFactory } from './types';

/**
 * 创建并初始化注册中心
 */
export function createAlgorithmRegistry(): CogAlgorithmRegistry {
  const registry = new CogAlgorithmRegistry();
  registry.initDefault();
  return registry;
}

/**
 * 注册单个算法到注册中心
 */
export function registerAlgorithm(
  registry: CogAlgorithmRegistry,
  name: string,
  factory: AlgorithmFactory,
): void {
  registry.register(name, factory);
}
