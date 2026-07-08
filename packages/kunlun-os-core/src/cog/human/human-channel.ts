/**
 * HumanChannel — 人类节点异步通信通道
 */

import type { HumanNode } from './types.js';
import type { CogMessage } from '../kal';

interface PendingMessage {
  messageId: string;
  nodeId: string;
  message: string;
  options: { ttl: number; priority: number };
  timestamp: number;
  response?: CogMessage | null;
}

export class HumanChannel {
  private nodes: Map<string, HumanNode> = new Map();
  private pending: Map<string, PendingMessage[]> = new Map();

  /** 注册人类节点 */
  registerNode(node: HumanNode): void {
    this.nodes.set(node.id, node);
    this.pending.set(node.id, []);
  }

  /** 获取人类节点 */
  getNode(nodeId: string): HumanNode | undefined {
    return this.nodes.get(nodeId);
  }

  /** 异步发送消息给人类节点 */
  async sendAsync(
    nodeId: string,
    message: string,
    options: { ttl?: number; priority?: number } = {}
  ): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Human node not found: ${nodeId}`);
    }
    if (!this.canSend(nodeId)) {
      throw new Error(`Cannot send to node ${nodeId}: not available or budget exhausted`);
    }

    const messageId = `msg-${nodeId}-${Date.now()}`;
    this.pending.get(nodeId)!.push({
      messageId,
      nodeId,
      message,
      options: {
        ttl: options.ttl ?? 30000,
        priority: options.priority ?? 1,
      },
      timestamp: Date.now(),
    });

    // 消耗注意力预算
    node.presence.attentionBudget -= 1;
  }

  /** 轮询人类节点的回复 */
  async pollResponse(
    nodeId: string,
    messageId: string,
    timeout: number = 5000
  ): Promise<CogMessage | null> {
    const pendingList = this.pending.get(nodeId);
    if (!pendingList) {
      return null;
    }

    const entry = pendingList.find(p => p.messageId === messageId);
    if (!entry) {
      return null;
    }

    // 模拟：如果已超时或节点在线且有回复，返回结果
    // 在实际实现中会等待真实回复
    return entry.response ?? null;
  }

  /** 检查是否可以向节点发送消息 */
  canSend(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    if (node.status === 'offline') {
      return false;
    }
    if (node.presence.attentionBudget <= 0) {
      return false;
    }
    // 检查是否在活跃时间范围内
    const now = new Date();
    // 使用 UTC 小时简单模拟；实际实现会考虑时区
    const currentHour = now.getUTCHours();
    const [start, end] = node.presence.activeHours;
    if (start <= end) {
      return currentHour >= start && currentHour < end;
    }
    // 跨午夜的活跃时间
    return currentHour >= start || currentHour < end;
  }

  /** 获取节点待处理消息数 */
  getPendingCount(nodeId: string): number {
    const pendingList = this.pending.get(nodeId);
    if (!pendingList) {
      return 0;
    }
    return pendingList.length;
  }

  /** 清除节点待处理消息 */
  clearPending(nodeId: string): void {
    const pendingList = this.pending.get(nodeId);
    if (pendingList) {
      pendingList.length = 0;
    }
  }

  /** 为待处理消息设置回复（模拟用） */
  setResponse(nodeId: string, messageId: string, response: CogMessage): void {
    const pendingList = this.pending.get(nodeId);
    if (!pendingList) return;
    const entry = pendingList.find(p => p.messageId === messageId);
    if (entry) {
      entry.response = response;
    }
  }

  /** 更新节点状态 */
  updateStatus(nodeId: string, status: 'online' | 'away' | 'offline'): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      node.presence.lastSeen = Date.now();
    }
  }

  /** 获取所有注册节点 */
  getAllNodes(): HumanNode[] {
    return [...this.nodes.values()];
  }
}
