/**
 * CogHuman 类型定义 — 人类节点异步模型
 */

export interface HumanPresence {
  timezone: string;
  activeHours: [number, number]; // [start, end] in hours (0-24)
  lastSeen: number; // timestamp
  estimatedResponseTime: number; // ms
  attentionBudget: number; // remaining budget
}

export type CommunicationStyle = 'direct' | 'detailed' | 'visual';
export type DecisionSpeed = 'fast' | 'balanced' | 'thorough';

export interface HumanPreferences {
  communicationStyle: CommunicationStyle;
  decisionSpeed: DecisionSpeed;
  riskTolerance: number; // 0-1
}

export interface HumanNode {
  id: string;
  name: string;
  type: 'human';
  presence: HumanPresence;
  preferences: HumanPreferences;
  status: 'online' | 'away' | 'offline';
  capabilities: string[];
}
