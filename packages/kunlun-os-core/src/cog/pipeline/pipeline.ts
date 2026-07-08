/**
 * CognitivePipeline — 七层认知流数据管道
 *
 * perceive → think → express → memorize → govern → evolve → act
 * 每层有processors数组，数据流经所有层完成认知处理。
 */

import type { PipelineLayerType, PipelineData, PipelineStage } from './types.js';
import { PIPELINE_LAYER_ORDER } from './types.js';

export class CognitivePipeline {
  private stages: Map<PipelineLayerType, PipelineStage[]> = new Map();

  constructor() {
    for (const layer of PIPELINE_LAYER_ORDER) {
      this.stages.set(layer, []);
    }
  }

  /** 完整七层流运行 */
  async run(input: PipelineData): Promise<PipelineData> {
    let current = input;
    for (const layer of PIPELINE_LAYER_ORDER) {
      const processors = this.stages.get(layer)!;
      // 更新 type 以匹配当前层
      current = { ...current, type: layer };
      for (const processor of processors) {
        current = await processor.process(current);
      }
      // 记录链路
      current = {
        ...current,
        meta: {
          ...current.meta,
          chain: [...current.meta.chain, `${layer}:${processors.map(p => p.name).join(',')}`],
        },
      };
    }
    return current;
  }

  /** 添加处理器到指定层 */
  addProcessor(layer: PipelineLayerType, processor: PipelineStage): void {
    const processors = this.stages.get(layer);
    if (!processors) {
      throw new Error(`Unknown pipeline layer: ${layer}`);
    }
    processors.push(processor);
  }

  /** 获取某层的所有处理器 */
  getStage(layer: PipelineLayerType): PipelineStage[] {
    const processors = this.stages.get(layer);
    if (!processors) {
      throw new Error(`Unknown pipeline layer: ${layer}`);
    }
    return [...processors];
  }

  /** 运行并返回处理链 */
  async getChain(input: PipelineData): Promise<string[]> {
    const result = await this.run(input);
    return result.meta.chain;
  }

  /** 获取所有层名称 */
  getLayers(): PipelineLayerType[] {
    return [...PIPELINE_LAYER_ORDER];
  }

  /** 清除某层的所有处理器 */
  clearStage(layer: PipelineLayerType): void {
    const processors = this.stages.get(layer);
    if (!processors) {
      throw new Error(`Unknown pipeline layer: ${layer}`);
    }
    processors.length = 0;
  }

  /** 清除所有层的处理器 */
  clearAll(): void {
    for (const layer of PIPELINE_LAYER_ORDER) {
      this.stages.get(layer)!.length = 0;
    }
  }
}
