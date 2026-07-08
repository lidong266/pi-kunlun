/**
 * CogIPC — 认知进程间通信
 *
 * 类比 LiteOS-A IPC（Queue/Event/Mutex）
 * 设计文档第7.8节
 */

import type { CogMessage } from './types';

// ═══════════════════════════════════════════════════════════════
// CogQueue — 认知消息队列
// ═══════════════════════════════════════════════════════════════

export class CogQueue<T = unknown> {
  private name: string;
  private capacity: number;
  private messages: Array<{ data: T; timestamp: number }> = [];
  private sendWaiters: Array<{ resolve: () => void }> = [];
  private recvWaiters: Array<{ resolve: (data: T) => void; reject: (err: Error) => void }> = [];

  constructor(name: string, capacity = 100) {
    this.name = name;
    this.capacity = capacity;
  }

  /** 发送消息（非阻塞） */
  send(data: T): boolean {
    if (this.messages.length >= this.capacity) return false;
    this.messages.push({ data, timestamp: Date.now() });

    // 唤醒等待接收者
    const waiter = this.recvWaiters.shift();
    if (waiter) {
      const msg = this.messages.shift();
      if (msg) waiter.resolve(msg.data);
    }

    return true;
  }

  /** 接收消息（阻塞，带超时） */
  async receive(timeoutMs = 5000): Promise<T> {
    if (this.messages.length > 0) {
      const msg = this.messages.shift()!;
      return msg.data;
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.recvWaiters.findIndex(w => w.resolve === resolve);
        if (idx >= 0) this.recvWaiters.splice(idx, 1);
        reject(new Error(`CogQueue[${this.name}]: receive timeout`));
      }, timeoutMs);

      this.recvWaiters.push({
        resolve: (data: T) => {
          clearTimeout(timer);
          resolve(data);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  /** 获取队列大小 */
  size(): number {
    return this.messages.length;
  }

  /** 获取队列名称 */
  getName(): string {
    return this.name;
  }

  /** 清空队列 */
  clear(): void {
    this.messages = [];
  }
}

// ═══════════════════════════════════════════════════════════════
// CogEvent — 认知事件通知
// ═══════════════════════════════════════════════════════════════

export class CogEvent {
  private name: string;
  private eventMask: number;
  private currentMask = 0;
  private waiters: Array<{
    resolve: (mask: number) => void;
    waitMask: number;
  }> = [];

  constructor(name: string, eventMask = 0xFFFFFFFF) {
    this.name = name;
    this.eventMask = eventMask;
  }

  /** 设置事件位 */
  set(mask: number): void {
    this.currentMask |= (mask & this.eventMask);
    this.notifyWaiters();
  }

  /** 清除事件位 */
  clear(mask: number): void {
    this.currentMask &= ~mask;
  }

  /** 等待事件 */
  async wait(waitMask: number, timeoutMs = 5000): Promise<number> {
    if (this.currentMask & waitMask) {
      const result = this.currentMask & waitMask;
      this.currentMask &= ~result;
      return result;
    }

    return new Promise<number>((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(0);
      }, timeoutMs);

      this.waiters.push({
        resolve: (mask: number) => {
          clearTimeout(timer);
          resolve(mask);
        },
        waitMask,
      });
    });
  }

  private notifyWaiters(): void {
    const remaining: typeof this.waiters = [];
    for (const waiter of this.waiters) {
      if (this.currentMask & waiter.waitMask) {
        const result = this.currentMask & waiter.waitMask;
        this.currentMask &= ~result;
        waiter.resolve(result);
      } else {
        remaining.push(waiter);
      }
    }
    this.waiters = remaining;
  }

  getName(): string {
    return this.name;
  }
}

// ═══════════════════════════════════════════════════════════════
// CogMutex — 认知互斥锁
// ═══════════════════════════════════════════════════════════════

export class CogMutex {
  private name: string;
  private locked = false;
  private waiters: Array<{ resolve: () => void }> = [];

  constructor(name: string) {
    this.name = name;
  }

  /** 尝试获取锁 */
  tryLock(): boolean {
    if (!this.locked) {
      this.locked = true;
      return true;
    }
    return false;
  }

  /** 获取锁（阻塞） */
  async lock(timeoutMs?: number): Promise<boolean> {
    if (!this.locked) {
      this.locked = true;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const timer = timeoutMs ? setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(false);
      }, timeoutMs) : null;

      this.waiters.push({
        resolve: () => {
          if (timer) clearTimeout(timer);
          this.locked = true;
          resolve(true);
        },
      });
    });
  }

  /** 释放锁 */
  unlock(): void {
    this.locked = false;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve();
  }

  isLocked(): boolean {
    return this.locked;
  }

  getName(): string {
    return this.name;
  }
}

// ═══════════════════════════════════════════════════════════════
// CogIPC — 静态工厂
// ═══════════════════════════════════════════════════════════════

export class CogIPC {
  private static queues = new Map<string, CogQueue<any>>();
  private static events = new Map<string, CogEvent>();
  private static mutexes = new Map<string, CogMutex>();

  static createCogQueue<T = unknown>(name: string, capacity = 100): CogQueue<T> {
    const q = new CogQueue<T>(name, capacity);
    this.queues.set(name, q);
    return q;
  }

  static createCogEvent(name: string, eventMask?: number): CogEvent {
    const ev = new CogEvent(name, eventMask);
    this.events.set(name, ev);
    return ev;
  }

  static createCogMutex(name: string): CogMutex {
    const mtx = new CogMutex(name);
    this.mutexes.set(name, mtx);
    return mtx;
  }

  static getQueue(name: string): CogQueue | undefined {
    return this.queues.get(name);
  }

  static getEvent(name: string): CogEvent | undefined {
    return this.events.get(name);
  }

  static getMutex(name: string): CogMutex | undefined {
    return this.mutexes.get(name);
  }

  static destroyAll(): void {
    this.queues.clear();
    this.events.clear();
    this.mutexes.clear();
  }
}
