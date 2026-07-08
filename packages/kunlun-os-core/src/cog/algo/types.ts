/**
 * CogAlgo 类型定义 — 算法Plugin接口和类型
 *
 * 参考设计文档：四大算法Plugin注册机制
 */

import type { Trit } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════════
// 算法Plugin核心接口
// ═══════════════════════════════════════════════════════════════

export type InferMode = 'sync' | 'async' | 'spiral';

export interface AlgorithmContext {
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface AnalysisRequest {
  input: unknown;
  context: Record<string, unknown>;
}

export interface AnalysisResponse {
  output: unknown;
  confidence: number;
  reasoning: string;
}

export interface IterationRequest {
  input: unknown;
  maxCycles: number;
}

export interface IterationState {
  cycle: number;
  output: unknown;
  converged: boolean;
}

export interface IterationResponse {
  output: unknown;
  cycles: number;
  converged: boolean;
}

export interface ICogAlgorithm {
  readonly name: string;
  readonly version: string;
  readonly inferMode: InferMode;

  prepare(sessionId: string, ctx: AlgorithmContext): Promise<void>;
  analyze(request: AnalysisRequest): Promise<AnalysisResponse>;
  iterate(request: IterationRequest, onProgress?: (state: IterationState) => void): Promise<IterationResponse>;
  setOption(option: string, value: unknown): void;
  getOption(option: string): unknown;
  release(sessionId: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// 算法工厂类型
// ═══════════════════════════════════════════════════════════════

export type AlgorithmFactory = () => ICogAlgorithm;
