/**
 * ContradictionPlugin — 矛盾分析引擎Plugin
 *
 * 封装 @kunlun/contradiction 的 ContradictionEngine
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
import {
  createContradictionEngine,
  type ContradictionEngine,
} from '@kunlun/contradiction';

export class ContradictionPlugin implements ICogAlgorithm {
  readonly name = 'contradiction';
  readonly version = '0.1.0';
  readonly inferMode: InferMode = 'async';

  private engine: ContradictionEngine | null = null;
  private options: Map<string, unknown> = new Map();

  async prepare(sessionId: string, ctx: AlgorithmContext): Promise<void> {
    this.engine = createContradictionEngine();
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    if (!this.engine) {
      throw new Error('ContradictionPlugin not prepared');
    }

    try {
      // 如果输入是矛盾对数组，使用 analyzeMultiple
      const input = request.input as { contradictions?: unknown[] };
      let output: unknown;

      if (input.contradictions && Array.isArray(input.contradictions)) {
        output = this.engine.analyzeMultiple(input.contradictions as never);
      } else {
        output = this.engine.analyzeSingle(request.input as never);
      }

      return {
        output,
        confidence: 0.8,
        reasoning: `矛盾分析完成`,
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
    // 矛盾引擎不天然支持迭代，模拟简单迭代
    let converged = false;
    let currentOutput: unknown = request.input;
    let cycles = 0;

    for (let i = 0; i < request.maxCycles && !converged; i++) {
      const result = await this.analyze({
        input: currentOutput,
        context: {},
      });
      cycles = i + 1;
      currentOutput = result.output;
      converged = result.confidence > 0.95;

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
