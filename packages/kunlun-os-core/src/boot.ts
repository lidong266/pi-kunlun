/**
 * CogBoot — 昆仑OS 6阶段引导
 *
 * 参考设计文档第23章：
 *   phase0: 基础设施 — IPC + 内存池初始化
 *   phase1: 内核 — 调度器 + GC启动
 *   phase2: 信任 — 信任框架初始化
 *   phase3: 能力 — 能力注册（注册内置能力）
 *   phase4: 总线 — 认知总线 + 节点发现启动
 *   phase5: 算法 — 算法引擎注册默认Plugin
 *
 * 类比 HarmonyOS 系统启动流程
 */

import type { KunlunOSConfig, BootPhaseLog } from './types';
import { BootAnimator } from './boot-animation';

import { CogScheduler, CogMultiInstanceManager, CogIPC } from './cog/kal';
import { CognEventBus } from './cog/bus';
import { CogAlgorithmRegistry } from './cog/algo';
import { CogCapabilityRegistry } from './cog/capability';
import type { CogCapabilityProvider } from './cog/capability';
import { TrustManager } from './cog/trust';
import { TokenManager, AttentionScheduler } from './cog/memory';
import { CognitivePipeline } from './cog/pipeline';
import { CogProcessManager } from './cog/process';
import { HumanChannel } from './cog/human';
import { MetaSynthesisEngine, MetaSynthesisWorkshop } from './cog/metasynthesis';
import { CogTaskExecutor } from './cog/executor';

// ═══════════════════════════════════════════════════════════════
// BootResult — 引导完成后的子系统实例集合
// ═══════════════════════════════════════════════════════════════

export interface BootResult {
  scheduler: CogScheduler;
  multiInstance: CogMultiInstanceManager;
  ipc: CogIPC;
  bus: CognEventBus;
  algoRegistry: CogAlgorithmRegistry;
  capabilityRegistry: CogCapabilityRegistry;
  trustManager: TrustManager;
  tokenManager: TokenManager;
  attentionScheduler: AttentionScheduler;
  pipeline: CognitivePipeline;
  processManager: CogProcessManager;
  humanChannel: HumanChannel;
  metasynthesisEngine: MetaSynthesisEngine;
  metasynthesisWorkshop: MetaSynthesisWorkshop | null;
  executor: CogTaskExecutor;
  logs: BootPhaseLog[];
  instanceIds: string[];
}

// ═══════════════════════════════════════════════════════════════
// 内置能力提供者（用于phase3注册）
// ═══════════════════════════════════════════════════════════════

class BuiltinCapabilityProvider implements CogCapabilityProvider {
  id = 'kunlun-os-builtin';
  capabilities = [
    { type: 'perceive' as const, provider: 'kunlun-os-builtin', name: 'basic-perceive', version: '0.1.0', cost: { tokensPerCall: 100, avgLatencyMs: 10 }, status: 'available' as const },
    { type: 'think' as const, provider: 'kunlun-os-builtin', name: 'basic-think', version: '0.1.0', cost: { tokensPerCall: 200, avgLatencyMs: 20 }, status: 'available' as const },
    { type: 'express' as const, provider: 'kunlun-os-builtin', name: 'basic-express', version: '0.1.0', cost: { tokensPerCall: 150, avgLatencyMs: 15 }, status: 'available' as const },
    { type: 'act' as const, provider: 'kunlun-os-builtin', name: 'basic-act', version: '0.1.0', cost: { tokensPerCall: 50, avgLatencyMs: 5 }, status: 'available' as const },
    { type: 'memorize' as const, provider: 'kunlun-os-builtin', name: 'basic-memorize', version: '0.1.0', cost: { tokensPerCall: 80, avgLatencyMs: 8 }, status: 'available' as const },
  ];
  private _registered = false;
  register(): void { this._registered = true; }
  heartbeat(): void { /* no-op */ }
  unregister(): void { this._registered = false; }
  get isRegistered(): boolean { return this._registered; }
}

// ═══════════════════════════════════════════════════════════════
// CogBoot 主类
// ═══════════════════════════════════════════════════════════════

export class CogBoot {
  private config: KunlunOSConfig;
  private logs: BootPhaseLog[] = [];
  private result: BootResult | null = null;

  constructor(config: KunlunOSConfig) {
    this.config = config;
  }

  // ─── 日志辅助 ──────────────────────────────────

  private log(phase: number, name: string, status: 'success' | 'error', duration: number, message: string): void {
    const entry: BootPhaseLog = { phase, name, status, duration, message, timestamp: Date.now() };
    this.logs.push(entry);
    if (this.config.verbose) {
      const tag = status === 'success' ? 'OK' : 'FAIL';
      console.log(`[CogBoot] phase${phase} ${name} [${tag}] ${duration}ms — ${message}`);
    }
  }

  // ─── Phase 0: 基础设施 — IPC + 内存池 ──────────

  phase0_base(): void {
    const start = Date.now();
    try {
      // IPC 初始化（CogIPC是静态工具类，此处验证可用性）
      const ipc = new CogIPC();
      // 内存池初始化由TokenManager在后续阶段处理
      this.log(0, 'base', 'success', Date.now() - start, 'IPC + memory pool initialized');
    } catch (e) {
      this.log(0, 'base', 'error', Date.now() - start, String(e));
      throw e;
    }
  }

  // ─── Phase 1: 内核 — 调度器 + GC ──────────────

  phase1_kernel(scheduler: CogScheduler, multiInstance: CogMultiInstanceManager): void {
    const start = Date.now();
    try {
      // 注册初始认知实例
      const instanceIds: string[] = [];
      for (let i = 0; i < this.config.kal.initialInstances; i++) {
        const id = `${this.config.instanceId}-kernel-${i}`;
        scheduler.registerInstance(id);
        instanceIds.push(id);
      }
      // GC在此框架中由调度器的超时/错误任务回收机制覆盖
      this.log(1, 'kernel', 'success', Date.now() - start, `Scheduler started with ${instanceIds.length} instance(s)`);
    } catch (e) {
      this.log(1, 'kernel', 'error', Date.now() - start, String(e));
      throw e;
    }
  }

  // ─── Phase 2: 信任框架 ────────────────────────

  phase2_trust(trustManager: TrustManager): void {
    const start = Date.now();
    try {
      // 信任框架初始化 — 价值对齐配置已在KunlunOS中设置
      // 信任管理器即用即初始化，此处验证可用性
      const level = trustManager.getTrustLevel(this.config.instanceId);
      this.log(2, 'trust', 'success', Date.now() - start, `Trust framework initialized (self level: ${level})`);
    } catch (e) {
      this.log(2, 'trust', 'error', Date.now() - start, String(e));
      throw e;
    }
  }

  // ─── Phase 3: 能力注册 ────────────────────────

  phase3_capabilities(capabilityRegistry: CogCapabilityRegistry): void {
    const start = Date.now();
    try {
      if (this.config.capability.registerBuiltin) {
        const provider = new BuiltinCapabilityProvider();
        capabilityRegistry.register(provider);
      }
      this.log(3, 'capabilities', 'success', Date.now() - start, 'Capability registry initialized');
    } catch (e) {
      this.log(3, 'capabilities', 'error', Date.now() - start, String(e));
      throw e;
    }
  }

  // ─── Phase 4: 认知总线 + 节点发现 ──────────────

  phase4_bus(bus: CognEventBus): void {
    const start = Date.now();
    try {
      // 创建默认会话
      const sessionId = bus.createSession('default', 'session');
      this.log(4, 'bus', 'success', Date.now() - start, `Cognitive bus started (session: ${sessionId})`);
    } catch (e) {
      this.log(4, 'bus', 'error', Date.now() - start, String(e));
      throw e;
    }
  }

  // ─── Phase 5: 算法引擎注册默认Plugin ───────────

  phase5_algorithms(algoRegistry: CogAlgorithmRegistry): void {
    const start = Date.now();
    try {
      if (this.config.algo.registerDefaults) {
        algoRegistry.initDefault();
      }
      const count = algoRegistry.listAlgorithms().length;
      this.log(5, 'algorithms', 'success', Date.now() - start, `Algorithm registry initialized (${count} plugins)`);
    } catch (e) {
      this.log(5, 'algorithms', 'error', Date.now() - start, String(e));
      throw e;
    }
  }

  // ─── 安全执行阶段（带动画） ────────────────────

  private executePhase(
    animator: BootAnimator | null,
    phase: number,
    name: string,
    fn: () => void,
  ): void {
    animator?.startPhase(phase);
    try {
      fn();
      animator?.completePhase(phase, 'success');
    } catch (e) {
      animator?.completePhase(phase, 'error');
      throw e;
    }
  }

  // ─── start: 顺序执行所有阶段 ───────────────────

  async start(): Promise<BootResult> {
    const bootStart = Date.now();
    this.logs = [];

    // 启动动画
    const showAnim = this.config.showBootAnim !== false;
    const animator = showAnim ? new BootAnimator() : null;
    animator?.showLogo();

    // 实例化所有子系统
    const scheduler = new CogScheduler();
    const multiInstance = new CogMultiInstanceManager(scheduler);
    const ipc = new CogIPC();
    const bus = new CognEventBus();
    const algoRegistry = new CogAlgorithmRegistry();
    const capabilityRegistry = new CogCapabilityRegistry();
    const trustManager = new TrustManager();
    const tokenManager = new TokenManager();
    const attentionScheduler = new AttentionScheduler();
    const pipeline = new CognitivePipeline();
    const processManager = new CogProcessManager();
    const humanChannel = new HumanChannel();
    const metasynthesisEngine = new MetaSynthesisEngine();
    const executor = new CogTaskExecutor();

    // 收集实例ID
    const instanceIds: string[] = [];

    // Phase 0
    this.executePhase(animator, 0, 'base', () => this.phase0_base());

    // Phase 1
    this.executePhase(animator, 1, 'kernel', () => {
      this.phase1_kernel(scheduler, multiInstance);
      for (let i = 0; i < this.config.kal.initialInstances; i++) {
        instanceIds.push(`${this.config.instanceId}-kernel-${i}`);
      }
    });

    // Phase 2
    this.executePhase(animator, 2, 'trust', () => this.phase2_trust(trustManager));

    // Phase 3
    this.executePhase(animator, 3, 'capabilities', () => this.phase3_capabilities(capabilityRegistry));

    // Phase 4
    this.executePhase(animator, 4, 'bus', () => this.phase4_bus(bus));

    // Phase 5
    this.executePhase(animator, 5, 'algorithms', () => this.phase5_algorithms(algoRegistry));

    const bootDuration = Date.now() - bootStart;

    // 启动完成动画
    if (animator) {
      animator.showBootComplete({
        durationMs: bootDuration,
        phaseCount: 6,
        subsystemCount: 13,
        instanceIds,
      });
    }

    this.result = {
      scheduler,
      multiInstance,
      ipc,
      bus,
      algoRegistry,
      capabilityRegistry,
      trustManager,
      tokenManager,
      attentionScheduler,
      pipeline,
      processManager,
      humanChannel,
      metasynthesisEngine,
      metasynthesisWorkshop: null,
      executor,
      logs: [...this.logs],
      instanceIds,
    };

    return this.result;
  }

  // ─── 获取引导日志 ──────────────────────────────

  getLogs(): BootPhaseLog[] {
    return [...this.logs];
  }
}
