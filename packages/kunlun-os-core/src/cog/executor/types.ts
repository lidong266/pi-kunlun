/**
 * CogExecutor 类型定义 — 认知执行引擎
 */

export type ExecuteMode = 'sync' | 'async' | 'spiral';

export interface ExecuteRequest {
  sessionId: string;
  algorithm: string;
  mode: ExecuteMode;
  input: unknown;
}

export interface ExecuteResponse {
  output: unknown;
  mode: ExecuteMode;
  cycles?: number;
}

export interface SpiralState {
  iteration: number;
  maxIterations: number;
  lastOutput: unknown;
  delta: number;
  converged: boolean;
}
