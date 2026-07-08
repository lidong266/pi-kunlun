/**
 * CogMultiInstanceManager — 多 Pi 实例管理器
 *
 * 类比 HarmonyOS SMP 多核启动（HalArchCpuOn）
 * 设计文档第7.7节
 */

import { CogScheduler } from './scheduler';
import type { CogRunqueue } from './types';

export class CogMultiInstanceManager {
  private scheduler: CogScheduler;
  private instanceCounter = 0;

  constructor(scheduler: CogScheduler) {
    this.scheduler = scheduler;
  }

  /**
   * 启动一个新的认知实例
   * 类比 HalArchCpuOn / secondary_cpu_start
   */
  async spawnInstance(
    instanceId?: string,
    initFunc?: (instanceId: string) => Promise<void>,
  ): Promise<string> {
    const id = instanceId || `pi-instance-${++this.instanceCounter}-${Date.now()}`;

    const rq = this.scheduler.registerInstance(id);

    if (initFunc) {
      await initFunc(id);
    }

    return id;
  }

  /** 获取所有实例 */
  getInstances(): string[] {
    return this.scheduler.getInstanceIds();
  }

  /** 获取实例数量 */
  getInstanceCount(): number {
    return this.scheduler.getInstanceIds().length;
  }

  /** 关闭实例 */
  shutdownInstance(instanceId: string): void {
    this.scheduler.unregisterInstance(instanceId);
  }
}
