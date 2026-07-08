/**
 * ProtractedWarPlugin — 持久战策略引擎Plugin
 *
 * 封装 @kunlun/pw 的 ProtractedWarEngine
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
import { ProtractedWarEngine } from '@kunlun/pw';
import type { PWContext } from '@kunlun/pw';

export class ProtractedWarPlugin implements ICogAlgorithm {
  readonly name = 'protracted-war';
  readonly version = '0.1.0';
  readonly inferMode: InferMode = 'async';

  private engine: ProtractedWarEngine | null = null;
  private options: Map<string, unknown> = new Map();

  async prepare(sessionId: string, ctx: AlgorithmContext): Promise<void> {
    this.engine = new ProtractedWarEngine();
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    if (!this.engine) {
      throw new Error('ProtractedWarPlugin not prepared');
    }

    try {
      const input = request.input as PWContext;
      const assessment = await this.engine.assessPhase(input);

      return {
        output: assessment,
        confidence: 0.8,
        reasoning: `持久战阶段评估完成，当前阶段: ${assessment.currentPhase}`,
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
      throw new Error('ProtractedWarPlugin not prepared');
    }

    let converged = false;
    let currentOutput: unknown = null;
    let cycles = 0;

    for (let i = 0; i < request.maxCycles && !converged; i++) {
      const result = await this.analyze({
        input: request.input,
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
