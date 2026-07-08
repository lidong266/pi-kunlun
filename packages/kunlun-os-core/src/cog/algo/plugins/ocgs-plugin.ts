/**
 * OCGSPlugin — 开放复杂巨系统自适应Plugin
 *
 * 封装 @kunlun/ocgs 的 OCGSOrchestrator
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
import { createOCGSOrchestrator } from '@kunlun/ocgs';
import type { IOCGSOrchestrator, FullCycleResult } from '@kunlun/ocgs';

export class OCGSPlugin implements ICogAlgorithm {
  readonly name = 'ocgs';
  readonly version = '0.1.0';
  readonly inferMode: InferMode = 'async';

  private orchestrator: IOCGSOrchestrator | null = null;
  private options: Map<string, unknown> = new Map();

  async prepare(sessionId: string, ctx: AlgorithmContext): Promise<void> {
    this.orchestrator = createOCGSOrchestrator();
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    if (!this.orchestrator) {
      throw new Error('OCGSPlugin not prepared');
    }

    try {
      const result: FullCycleResult = await this.orchestrator.fullCycle();

      return {
        output: result,
        confidence: 0.75,
        reasoning: `OCGS 完整周期完成`,
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
    if (!this.orchestrator) {
      throw new Error('OCGSPlugin not prepared');
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
    this.orchestrator = null;
    this.options.clear();
  }
}
