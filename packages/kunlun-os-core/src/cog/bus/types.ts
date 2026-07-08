/**
 * CogBus 类型定义 — 认知事件总线核心类型系统
 *
 * 参考设计文档第8章：认知节点、会话、通道、载荷
 */

import type { Trit } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════════
// 认知节点类型
// ═══════════════════════════════════════════════════════════════

export type CogNodeType = 'pi-agent' | 'llm' | 'human' | 'tool' | 'knowledge-base';

export interface CogNodeCapabilities {
  perceive: boolean;
  think: boolean;
  express: boolean;
  act: boolean;
  memory: boolean;
}

export interface CogNodeInfo {
  id: string;
  type: CogNodeType;
  name: string;
  capabilities: CogNodeCapabilities;
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: number;
  ttl: number;
  reputation: number; // 0-1
  avgResponseTime: number;
  metadata: Record<string, unknown>;
}

export interface CogPublishInfo {
  nodeId: string;
  capabilities: CogNodeCapabilities;
  medium: 'event-bus' | 'mcp-bridge' | 'websocket' | 'direct-api';
  mode: 'passive' | 'active';
  ttl: number;
}

export interface CogSubscribeInfo {
  requiredCapabilities: Partial<CogNodeCapabilities>;
  minReputation: number;
}

// ═══════════════════════════════════════════════════════════════
// 认知会话与通道
// ═══════════════════════════════════════════════════════════════

export interface CogSession {
  id: string;
  name: string;
  type: 'unicast' | 'multicast' | 'session';
  participants: string[];
  createdAt: number;
}

export interface CogChannel {
  id: string;
  sessionId: string;
  type: 'data' | 'control';
  direction: 'in' | 'out' | 'bidirectional';
}

// ═══════════════════════════════════════════════════════════════
// 认知载荷
// ═══════════════════════════════════════════════════════════════

export type CogCognitivePayloadType = 'perception' | 'thought' | 'expression' | 'action' | 'memory';

export interface CogCognitivePayload {
  sessionId: string;
  type: CogCognitivePayloadType;
  data: unknown;
  source: string;
  timestamp: number;
  ttl: number;
}
