/**
 * KunlunOS Worker 事件总线 — 跨核洞察主动通知
 *
 * Worker 发现关键洞察后主动推送给其他 Worker，
 * 不等下轮被动拉取。KunlunOS 版"跨核中断信号"。
 *
 * OS 层 → KunlunOS 映射：
 *   - OS 核间中断(IPI) → 事件总线广播
 *   - 中断向量 → 事件 callback
 *   - 中断屏蔽 → unsubscribe
 *
 * 关键区别：这里传递的是文本洞察而非内存信号。
 * 最昂贵资源是 LLM API 调用（秒级延迟），不是 CPU 周期（纳秒级）。
 */

export interface KeyFindingEvent {
  sourceWorkerId: string;
  finding: string;
  /** 置信度 0-1，多条发现时取 0.8，单条取 0.6 */
  confidence: number;
  timestamp: number;
  /** 关键词标签，用于后续匹配目标 Worker */
  tags: string[];
}

export type InsightCallback = (event: KeyFindingEvent) => void;

export class InsightEventBus {
  /** 每个 Worker 的订阅回调列表 */
  private subscribers = new Map<string, InsightCallback[]>();
  /** 最近广播的关键发现（环形缓冲区） */
  private recentFindings: KeyFindingEvent[] = [];
  /** 最大保留数 */
  private readonly maxRecent: number;

  constructor(maxRecent = 50) {
    this.maxRecent = maxRecent;
  }

  /** Worker 注册监听 */
  subscribe(workerId: string, callback: InsightCallback): void {
    const subs = this.subscribers.get(workerId) ?? [];
    subs.push(callback);
    this.subscribers.set(workerId, subs);
  }

  /** Worker 取消监听 */
  unsubscribe(workerId: string, callback: InsightCallback): void {
    const subs = this.subscribers.get(workerId);
    if (subs) {
      const idx = subs.indexOf(callback);
      if (idx >= 0) subs.splice(idx, 1);
    }
  }

  /**
   * 广播关键发现给所有活跃 Worker（排除自己）
   *
   * 每个订阅了回调的 Worker（非 source）会立即收到事件。
   * 同时写入 recentFindings 供 getSince/getRecent 轮询。
   */
  broadcast(finding: KeyFindingEvent): void {
    // 写入环形缓冲区
    this.recentFindings.push(finding);
    if (this.recentFindings.length > this.maxRecent) {
      this.recentFindings.shift();
    }

    // 推送给所有非 source 的 Worker
    for (const [workerId, callbacks] of this.subscribers) {
      if (workerId !== finding.sourceWorkerId) {
        for (const cb of callbacks) cb(finding);
      }
    }
  }

  /** 获取自某时间戳以来的新发现（供 Worker 轮询） */
  getSince(timestamp: number): KeyFindingEvent[] {
    return this.recentFindings.filter(f => f.timestamp > timestamp);
  }

  /** 获取最近 N 条发现 */
  getRecent(maxCount = 10): KeyFindingEvent[] {
    return this.recentFindings.slice(-maxCount);
  }

  /** 获取订阅者数量 */
  get subscriberCount(): number {
    let count = 0;
    for (const subs of this.subscribers.values()) {
      count += subs.length;
    }
    return count;
  }

  /** 清空所有订阅和事件 */
  clear(): void {
    this.subscribers.clear();
    this.recentFindings = [];
  }
}
