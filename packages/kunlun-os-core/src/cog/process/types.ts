/**
 * CogProcess 类型定义 — 认知进程模型
 */

import type { PipelineLayerType } from '../pipeline';

export type CogProcessStage =
  | 'nascent'
  | 'exploring'
  | 'crystallizing'
  | 'expressing'
  | 'archived';

export interface CoreContradiction {
  thesis: string;
  antithesis: string;
  resolution?: string;
}

export interface ProcessResources {
  tokenBudget: number;
  attentionWeight: number;
  collaborators: string[];
}

export interface CogProcess {
  id: string;
  name: string;
  coreContradiction: CoreContradiction;
  stage: CogProcessStage;
  currentLayer: PipelineLayerType;
  resources: ProcessResources;
  subProcesses: string[];
  spawn(sub: Partial<CogProcess>): CogProcess;
  advance(): CogProcessStage;
  converge(): boolean;
  archive(): void;
}

/** 进程阶段推进顺序 */
export const PROCESS_STAGE_ORDER: CogProcessStage[] = [
  'nascent',
  'exploring',
  'crystallizing',
  'expressing',
  'archived',
];
