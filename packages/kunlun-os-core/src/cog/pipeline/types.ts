/**
 * CogPipeline 类型定义 — 七层认知流数据管道
 */

export type PipelineLayerType =
  | 'perceive'
  | 'think'
  | 'express'
  | 'memorize'
  | 'govern'
  | 'evolve'
  | 'act';

/** 七层认知流顺序 */
export const PIPELINE_LAYER_ORDER: PipelineLayerType[] = [
  'perceive',
  'think',
  'express',
  'memorize',
  'govern',
  'evolve',
  'act',
];

export interface PipelineDataMeta {
  source: string;
  confidence: number; // 0-1
  timestamp: number;
  chain: string[];
}

export interface PipelineData {
  type: PipelineLayerType;
  payload: unknown;
  meta: PipelineDataMeta;
}

export interface PipelineStage {
  name: string;
  type: PipelineLayerType;
  process(input: PipelineData): Promise<PipelineData>;
}
