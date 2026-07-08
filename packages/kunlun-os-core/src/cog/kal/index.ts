/**
 * — 认知内核抽象层
 *
 * 多认知核心调度器 + 多实例管理 + IPC
 * 参考设计文档第6-7章
 */

// ─── 核心类型 ───
export type {
  CogTaskCB,
  CogTaskContext,
  CogRunqueue,
  CogSchedPolicy,
  CogTaskType,
  CogKernelType,
  KernelAffinity,
  CogMessage,
  CogIPIMessage,
  CogSchedStats,
} from './types';

export {
  CogTaskStatus,
  CogPriority,
  CogSignal,
  CogIPIType,
  priorityFromLevel,
} from './types';

// ─── 调度器 ───
export { CogScheduler } from './scheduler';

// ─── 多实例管理 ───
export { CogMultiInstanceManager } from './multi-instance';

// ─── IPC ───
export {
  CogQueue,
  CogEvent,
  CogMutex,
  CogIPC,
} from './ipc';
