/**
 * CogTaskExecutor — 认知执行引擎
 *
 * 支持三种执行模式：同步、异步、螺旋
 */

import type { ExecuteMode, ExecuteRequest, ExecuteResponse, SpiralState } from './types.js';

export class CogTaskExecutor {
  private sessions: Map<string, SpiralState> = new Map();

  /** 执行请求 */
  async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
    switch (req.mode) {
      case 'sync':
        return this.sync(req.algorithm, req);
      case 'async':
        return this.async(req.algorithm, req);
      case 'spiral':
        return this.spiral(req.algorithm, req);
      default:
        throw new Error(`Unknown execute mode: ${req.mode}`);
    }
  }

  /** 同步执行 */
  async sync(algo: string, req: ExecuteRequest): Promise<ExecuteResponse> {
    // 模拟同步执行：立即返回结果
    const output = {
      algorithm: algo,
      input: req.input,
      result: `sync-result-for-${req.sessionId}`,
      timestamp: Date.now(),
    };
    return {
      output,
      mode: 'sync',
    };
  }

  /** 异步执行 */
  async async(algo: string, req: ExecuteRequest): Promise<ExecuteResponse> {
    // 模拟异步执行：返回后异步处理
    const output = {
      algorithm: algo,
      input: req.input,
      result: `async-result-for-${req.sessionId}`,
      timestamp: Date.now(),
    };
    return {
      output,
      mode: 'async',
    };
  }

  /** 螺旋执行：最多10次迭代，收敛则提前结束 */
  async spiral(algo: string, req: ExecuteRequest): Promise<ExecuteResponse> {
    const maxIterations = 10;
    let iteration = 0;
    let lastOutput: unknown = req.input;
    let delta = 1.0;
    let converged = false;

    while (iteration < maxIterations && !converged) {
      iteration++;
      // 模拟每次迭代输出越来越接近稳定值
      const newOutput = {
        algorithm: algo,
        iteration,
        input: req.input,
        result: `spiral-iter-${iteration}-for-${req.sessionId}`,
        delta,
        timestamp: Date.now(),
      };

      // 模拟收敛：delta随迭代递减
      delta = delta * 0.6;
      if (this.isConverged({ iteration, maxIterations, lastOutput, delta, converged })) {
        converged = true;
      }

      lastOutput = newOutput;
    }

    // 保存螺旋状态
    this.sessions.set(req.sessionId, {
      iteration,
      maxIterations,
      lastOutput,
      delta,
      converged,
    });

    return {
      output: lastOutput,
      mode: 'spiral',
      cycles: iteration,
    };
  }

  /** 判断是否收敛 */
  isConverged(state: SpiralState): boolean {
    // delta小于阈值即认为收敛
    return state.delta < 0.1;
  }

  /** 获取会话螺旋状态 */
  getSessionState(sessionId: string): SpiralState | undefined {
    return this.sessions.get(sessionId);
  }

  /** 清除会话 */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
