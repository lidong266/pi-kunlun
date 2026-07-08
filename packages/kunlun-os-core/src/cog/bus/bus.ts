/**
 * CognEventBus — 认知事件总线
 *
 * 双通道设计：
 * - 数据通道：感知结果/思考输出/行动指令（单播/多播/会话）
 * - 控制通道：认知IPI（WAKEUP/SCHEDULE/HALT/FUNC_CALL）
 *
 * 参考设计文档第8章
 */

import { TernaryEventBus } from '@kunlun/eventbus';
import type { ITernaryEventBus } from '@kunlun/eventbus';
import type { CogIPIMessage } from '../kal';
import { CogIPIType } from '../kal';
import {
  CogLedger,
  CogDiscoveryManager,
} from './discovery';
import type {
  CogNodeInfo,
  CogPublishInfo,
  CogSubscribeInfo,
  CogSession,
  CogChannel,
  CogCognitivePayload,
} from './types';

// ═══════════════════════════════════════════════════════════════
// CognEventBus
// ═══════════════════════════════════════════════════════════════

export class CognEventBus {
  private eventBus: ITernaryEventBus;
  private ledger: CogLedger;
  private discovery: CogDiscoveryManager;
  private sessions: Map<string, CogSession> = new Map();
  private channels: Map<string, CogChannel> = new Map();
  private dataQueues: Map<string, CogCognitivePayload[]> = new Map();

  constructor() {
    this.eventBus = new TernaryEventBus();
    this.ledger = new CogLedger();
    this.discovery = new CogDiscoveryManager(this.ledger);
  }

  // ─── 会话管理 ───

  createSession(name: string, type: CogSession['type']): string {
    const id = `cog-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const session: CogSession = {
      id,
      name,
      type,
      participants: [],
      createdAt: Date.now(),
    };
    this.sessions.set(id, session);
    return id;
  }

  closeSession(id: string): void {
    this.sessions.delete(id);
    // 清理关联通道
    for (const [channelId, channel] of this.channels.entries()) {
      if (channel.sessionId === id) {
        this.channels.delete(channelId);
        this.dataQueues.delete(channelId);
      }
    }
  }

  // ─── 节点注册与发现 ───

  joinCogNetwork(info: CogPublishInfo): string {
    const nodeId = info.nodeId;
    this.discovery.publish(info);
    return nodeId;
  }

  leaveCogNetwork(id: string): void {
    this.ledger.unregister(id);
  }

  publishCogNode(info: CogPublishInfo): void {
    this.discovery.publish(info);
  }

  discoverCogNodes(filter: CogSubscribeInfo): CogNodeInfo[] {
    return this.discovery.getOnlineNodes().filter((n) =>
      this.discovery.matches(n, filter),
    );
  }

  // ─── 数据通道 ───

  sendCognition(channelId: string, payload: CogCognitivePayload): void {
    if (!this.dataQueues.has(channelId)) {
      this.dataQueues.set(channelId, []);
    }
    this.dataQueues.get(channelId)!.push(payload);
  }

  receiveCognition(channelId: string): CogCognitivePayload | null {
    const queue = this.dataQueues.get(channelId);
    if (!queue || queue.length === 0) {
      return null;
    }
    return queue.shift()!;
  }

  // ─── 控制通道（IPI） ───

  sendCogIPI(instanceId: string, ipi: CogIPIMessage): void {
    // 通过事件总线发送IPI消息
    this.eventBus.emit('cogbus:ipi', {
      trit: 0,
      ...ipi,
    } as never);
  }

  // ─── 事件系统 ───

  on(type: string, handler: (payload: unknown) => void): void {
    this.eventBus.on(type, handler);
  }

  emit(target: string, payload: unknown): void {
    this.eventBus.emit(target, {
      trit: 0,
      ...(payload as Record<string, unknown>),
    } as never);
  }

  // ─── 辅助方法 ───

  getLedger(): CogLedger {
    return this.ledger;
  }

  getDiscovery(): CogDiscoveryManager {
    return this.discovery;
  }

  getSessions(): Map<string, CogSession> {
    return this.sessions;
  }

  getChannels(): Map<string, CogChannel> {
    return this.channels;
  }
}
