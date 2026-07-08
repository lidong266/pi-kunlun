/**
 * CogProcessManager — 认知进程管理器
 */

import type {
  CogProcess,
  CogProcessStage,
  CoreContradiction,
  ProcessResources,
} from './types.js';
import { PROCESS_STAGE_ORDER } from './types.js';
import type { PipelineLayerType } from '../pipeline';
import { PIPELINE_LAYER_ORDER } from '../pipeline';

let idCounter = 0;

function nextId(): string {
  return `process-${++idCounter}`;
}

function createProcessFromContradiction(contradiction: CoreContradiction): CogProcess {
  const id = nextId();
  const proc: CogProcess = {
    id,
    name: contradiction.thesis,
    coreContradiction: { ...contradiction },
    stage: 'nascent',
    currentLayer: 'perceive',
    resources: {
      tokenBudget: 1000,
      attentionWeight: 1.0,
      collaborators: [],
    },
    subProcesses: [],
    spawn(sub: Partial<CogProcess>): CogProcess {
      const childId = nextId();
      const child: CogProcess = {
        id: childId,
        name: sub.name ?? `sub-${childId}`,
        coreContradiction: sub.coreContradiction ?? { thesis: '', antithesis: '' },
        stage: 'nascent',
        currentLayer: sub.currentLayer ?? 'perceive',
        resources: sub.resources ?? {
          tokenBudget: 500,
          attentionWeight: 0.5,
          collaborators: [],
        },
        subProcesses: [],
        spawn: proc.spawn,
        advance: proc.advance,
        converge: proc.converge,
        archive: proc.archive,
      };
      proc.subProcesses.push(childId);
      return child;
    },
    advance(): CogProcessStage {
      const idx = PROCESS_STAGE_ORDER.indexOf(proc.stage);
      if (idx < PROCESS_STAGE_ORDER.length - 1) {
        proc.stage = PROCESS_STAGE_ORDER[idx + 1]!;
        // 同步推进当前层
        const layerIdx = PIPELINE_LAYER_ORDER.indexOf(proc.currentLayer);
        if (layerIdx < PIPELINE_LAYER_ORDER.length - 1) {
          proc.currentLayer = PIPELINE_LAYER_ORDER[layerIdx + 1]!;
        }
      }
      return proc.stage;
    },
    converge(): boolean {
      return proc.coreContradiction.resolution !== undefined && proc.coreContradiction.resolution !== '';
    },
    archive(): void {
      proc.stage = 'archived';
    },
  };
  return proc;
}

export class CogProcessManager {
  private processes: Map<string, CogProcess> = new Map();

  /** 创建新认知进程 */
  createProcess(contradiction: CoreContradiction): CogProcess {
    const proc = createProcessFromContradiction(contradiction);
    this.processes.set(proc.id, proc);
    return proc;
  }

  /** 获取进程 */
  getProcess(id: string): CogProcess | undefined {
    return this.processes.get(id);
  }

  /** 获取所有进程 */
  getAllProcesses(): CogProcess[] {
    return [...this.processes.values()];
  }

  /** 推进进程到下一阶段 */
  advanceProcess(id: string): CogProcessStage {
    const proc = this.processes.get(id);
    if (!proc) {
      throw new Error(`Process not found: ${id}`);
    }
    return proc.advance();
  }

  /** 归档进程 */
  archiveProcess(id: string): void {
    const proc = this.processes.get(id);
    if (!proc) {
      throw new Error(`Process not found: ${id}`);
    }
    proc.archive();
  }

  /** 按阶段获取进程 */
  getByStage(stage: CogProcessStage): CogProcess[] {
    return this.getAllProcesses().filter(p => p.stage === stage);
  }

  /** 删除进程 */
  removeProcess(id: string): boolean {
    return this.processes.delete(id);
  }

  /** 进程数量 */
  count(): number {
    return this.processes.size;
  }
}
