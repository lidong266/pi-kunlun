/**
 * CogDiscoveryManager 和 CogLedger — 认知节点发现与注册
 *
 * 参考设计文档第8章
 */

import type {
  CogNodeInfo,
  CogPublishInfo,
  CogSubscribeInfo,
  CogNodeCapabilities,
} from './types';

// ═══════════════════════════════════════════════════════════════
// CogLedger — 认知节点账本
// ═══════════════════════════════════════════════════════════════

export class CogLedger {
  private nodes: Map<string, CogNodeInfo> = new Map();

  register(node: CogNodeInfo): void {
    this.nodes.set(node.id, { ...node });
  }

  unregister(id: string): void {
    this.nodes.delete(id);
  }

  find(filter: CogSubscribeInfo): CogNodeInfo[] {
    const results: CogNodeInfo[] = [];
    for (const node of this.nodes.values()) {
      if (matchesFilter(node, filter)) {
        results.push(node);
      }
    }
    return results;
  }

  getReputation(id: string): number {
    const node = this.nodes.get(id);
    return node ? node.reputation : 0;
  }

  getAll(): CogNodeInfo[] {
    return Array.from(this.nodes.values());
  }
}

// ═══════════════════════════════════════════════════════════════
// CogDiscoveryManager — 认知节点发现管理器
// ═══════════════════════════════════════════════════════════════

export class CogDiscoveryManager {
  private ledger: CogLedger;
  private discoveryCallbacks: Array<{
    subscribe: CogSubscribeInfo;
    cb: (node: CogNodeInfo) => void;
  }> = [];

  constructor(ledger: CogLedger) {
    this.ledger = ledger;
  }

  publish(info: CogPublishInfo): void {
    const nodeInfo: CogNodeInfo = {
      id: info.nodeId,
      type: 'pi-agent',
      name: info.nodeId,
      capabilities: info.capabilities,
      status: 'online',
      lastHeartbeat: Date.now(),
      ttl: info.ttl,
      reputation: 0.5,
      avgResponseTime: 0,
      metadata: {
        medium: info.medium,
        mode: info.mode,
      },
    };
    this.ledger.register(nodeInfo);

    // 通知所有匹配的订阅者
    for (const entry of this.discoveryCallbacks) {
      if (matchesFilter(nodeInfo, entry.subscribe)) {
        entry.cb(nodeInfo);
      }
    }
  }

  startDiscovery(
    subscribe: CogSubscribeInfo,
    cb: (node: CogNodeInfo) => void,
  ): void {
    this.discoveryCallbacks.push({ subscribe, cb });

    // 通知已存在的匹配节点
    const existing = this.ledger.find(subscribe);
    for (const node of existing) {
      cb(node);
    }
  }

  matches(node: CogNodeInfo, subscribe: CogSubscribeInfo): boolean {
    return matchesFilter(node, subscribe);
  }

  getOnlineNodes(): CogNodeInfo[] {
    return this.ledger.getAll().filter((n) => n.status === 'online');
  }
}

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function matchesFilter(node: CogNodeInfo, filter: CogSubscribeInfo): boolean {
  // 信誉过滤
  if (node.reputation < filter.minReputation) {
    return false;
  }

  // 能力匹配（部分匹配：要求的能力节点必须具备）
  const required = filter.requiredCapabilities;
  for (const key of Object.keys(required) as Array<keyof CogNodeCapabilities>) {
    if (required[key] === true && node.capabilities[key] !== true) {
      return false;
    }
  }

  return true;
}
