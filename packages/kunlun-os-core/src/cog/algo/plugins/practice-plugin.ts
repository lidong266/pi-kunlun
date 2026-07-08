/**
 * PracticePlugin — 实践螺旋引擎Plugin
 *
 * 封装 @kunlun/spiral 的 PracticeSpiralEngine
 */

import type {
  ICogAlgorithm,
  AlgorithmContext,
  AnalysisRequest,
  AnalysisResponse,
  IterationRequest,
  IterationResponse,
  IterationState,
  InferMode,
} from '../types';
import { PracticeSpiralEngine } from '@kunlun/spiral';
import type { PracticeContext } from '@kunlun/spiral';

export class PracticePlugin implements ICogAlgorithm {
  readonly name = 'practice';
  readonly version = '0.1.0';
  readonly inferMode: InferMode = 'spiral';

  private engine: PracticeSpiralEngine | null = null;
  private options: Map<string, unknown> = new Map();

  async prepare(sessionId: string, ctx: AlgorithmContext): Promise<void> {
    this.engine = new PracticeSpiralEngine();
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    if (!this.engine) {
      throw new Error('PracticePlugin not prepared');
    }

    try {
      const input = request.input as PracticeContext;
      const result = await this.engine.iterateSpiral(input);

      return {
        output: result,
        confidence: 0.75,
        reasoning: `实践螺旋分析完成，周期: ${result.cycleNumber}`,
      };
    } catch (error) {
      return {
        output: null,
        confidence: 0,
        reasoning: `分析错误: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async iterate(
    request: IterationRequest,
    onProgress?: (state: IterationState) => void,
  ): Promise<IterationResponse> {
    if (!this.engine) {
      throw new Error('PracticePlugin not prepared');
    }

    let converged = false;
    let currentOutput: unknown = null;
    let cycles = 0;

    for (let i = 0; i < request.maxCycles && !converged; i++) {
      const input = request.input as PracticeContext;
      const result = await this.engine.iterateSpiral(input);
      cycles = i + 1;
      currentOutput = result;

      // 检查螺旋是否收敛（位置变化小）
      converged = result.cycleNumber >= request.maxCycles;

      if (onProgress) {
        onProgress({ cycle: cycles, output: currentOutput, converged });
      }
    }

    return { output: currentOutput, cycles, converged };
  }

  setOption(option: string, value: unknown): void {
    this.options.set(option, value);
  }

  getOption(option: string): unknown {
    return this.options.get(option);
  }

  async release(sessionId: string): Promise<void> {
    this.engine = null;
    this.options.clear();
  }
}
