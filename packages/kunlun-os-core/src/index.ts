/**
 * @kunlun/os-core — 昆仑OS核心
 *
 * 认知操作系统核心，集成所有子系统。
 * 昆仑OS 是唯一对外接口层，内部通过 Pi 微内核驱动 LLM 调用和工具执行。
 *
 * 子系统来源：
 *   - @kunlun/subsystems — 谛听/太一/天工/琅嬛/归藏/镇岳/镇熵/玄关（八子系统）
 *   - @kunlun/contradiction — 矛盾分析引擎
 *   - @kunlun/spiral — 实践螺旋引擎
 *   - @kunlun/pw — 持久战策略引擎
 *   - @kunlun/ocgs — 开放复杂巨系统自适应层
 *   - @kunlun/cog-metasynthesis — 大成智慧学综合集成
 *   - @kunlun/cogkal — 认知内核调度器
 *   - @kunlun/cogbus — 认知事件总线
 *   - @kunlun/cog-algo — 算法插件注册
 *   - @kunlun/cog-capability — 认知能力注册
 *   - @kunlun/cog-trust — 信任管理
 *   - @kunlun/cog-memory — Token/记忆管理
 *   - @kunlun/cog-pipeline — 七层流管道
 *   - @kunlun/cog-process — 认知进程管理
 *   - @kunlun/cog-human — 人类节点通道
 *   - @kunlun/cog-executor — 认知执行引擎
 *   - @kunlun/ternary — 三进制数学底座
 *
 * OS 核心自有模块：
 *   - eleven-bridges — 十一桥知识卡片（大成智慧学知识基础设施）
 *   - kunlun-agent — 昆仑OS 统一 Agent 入口
 *   - cli — 命令行交互入口
 *   - pi-adapter — Pi Agent 集成适配器
 */

// ─── 类型 ───
export type {
  OSStatus,
  OSState,
  KunlunOSConfig,
  CogKALConfig,
  CogBusConfig,
  CogAlgoConfig,
  CogCapabilityConfig,
  CogTrustConfig,
  CogMemoryConfig,
  CogPipelineConfig,
  CogProcessConfig,
  CogHumanConfig,
  CogMetasynthesisConfig,
  CogExecutorConfig,
  BootPhaseLog,
} from './types';

// ─── 工厂函数 ───
export { defaultOSConfig } from './types';

// ─── 引导 ───
export { CogBoot } from './boot';
export type { BootResult } from './boot';

// ─── OS 主类 ───
export { KunlunOS, getKunlunOS, bootKunlunOS } from './kunlun-os';
export type {
  KunlunAnalysis,
  KunlunToolDecision,
} from './kunlun-os';

// ─── Agent 封装（对外统一 API） ───
export { KunlunAgent, getKunlunAgent, createKunlunAgent } from './kunlun-agent';
export type { KunlunAgentOptions } from './kunlun-agent';

// ─── 多微内核调度器 ───
export { MultiKernelOrchestrator, createOrchestrator } from './multi-kernel.js';
export type { KernelPoolConfig, SubTask, SubTaskResult } from './multi-kernel.js';

// ─── 共享认知层 ───
export { SharedCognitiveLayer, LLMResponseCache } from './shared-layer.js';
export type { SharedLayerConfig } from './shared-layer.js';

// ─── Worker 事件总线 ───
export { InsightEventBus } from './insight-bus.js';
export type { KeyFindingEvent, InsightCallback } from './insight-bus.js';

// ─── CLI 入口 ───
export { KunlunCLI } from './cli';
export { CognitiveCLI, runCognitiveCli } from './cognitive-cli';

// ─── 大成智慧学：十一桥知识卡片系统 ───
export {
  ELEVEN_BRIDGES,
  routeToBridge,
  getBridgeCards,
  getBridgeAxiom,
  getAllBridgeIds,
  getBridge,
} from './eleven-bridges';
export type {
  BridgeProfile,
  KnowledgeCard,
} from './eleven-bridges';

// ─── Harness 层（从 Pi 迁移来的上层功能） ───
export { AgentHarness } from './harness/agent-harness.js';
export type {
  AgentHarnessOptions,
  AgentHarnessResources,
  AgentHarnessStreamOptions,
  ExecutionEnv,
  Session,
  SessionRepo,
  SessionMetadata,
  Skill,
  PromptTemplate,
  AbortResult,
  NavigateTreeResult,
  AgentHarnessEvent,
  AgentHarnessEventResultMap,
  AgentHarnessOwnEvent,
} from './harness/types.js';
export { InMemorySessionRepo } from './harness/session/memory-repo.js';
export { JsonlSessionRepo } from './harness/session/jsonl-repo.js';
export { NodeExecutionEnv } from './harness/env/nodejs.js';

// ─── Pi Agent 集成（兼容旧 API） ───
export {
  createPiIntegration,
  startKunlun,
} from './pi-adapter';
export type {
  PiIntegrationConfig,
} from './pi-adapter';
