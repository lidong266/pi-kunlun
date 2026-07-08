/**
 * AttentionScheduler — 注意力调度器
 *
 * 根据矛盾级别、紧急度对任务进行注意力权重分配
 * 参考设计文档
 */

import type {
  AttentionSchedule,
  ContradictionLevel,
  SchedulableTask,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 矛盾级别 → 注意力权重映射
// ═══════════════════════════════════════════════════════════════

const CONTRADICTION_WEIGHTS: Record<ContradictionLevel, number> = {
  none: 0.3,
  low: 0.5,
  medium: 0.75,
  high: 0.95,
};

const CONTRADICTION_DURATIONS: Record<ContradictionLevel, number> = {
  none: 5000,
  low: 10000,
  medium: 20000,
  high: 60000,
};

// ═══════════════════════════════════════════════════════════════
// AttentionScheduler
// ═══════════════════════════════════════════════════════════════

export class AttentionScheduler {
  private activeSchedules: Map<string, AttentionSchedule> = new Map();

  /**
   * 从矛盾级别创建注意力调度
   *
   * 矛盾级别越高，注意力权重越大、专注时间越长、越不可中断
   */
  fromContradiction(level: ContradictionLevel): AttentionSchedule {
    const taskId = `contradiction-${level}-${Date.now()}`;
    const schedule: AttentionSchedule = {
      taskId,
      attentionWeight: CONTRADICTION_WEIGHTS[level],
      focusDuration: CONTRADICTION_DURATIONS[level],
      interruptible: level === 'none' || level === 'low',
    };
    this.activeSchedules.set(taskId, schedule);
    return schedule;
  }

  /**
   * 从截止时间创建注意力调度
   *
   * 越紧急的任务注意力权重越高
   */
  fromUrgency(deadline: number): AttentionSchedule {
    const now = Date.now();
    const remaining = deadline - now;
    let weight: number;
    let duration: number;
    let interruptible: boolean;

    if (remaining <= 0) {
      // 已过期 — 最高紧急
      weight = 0.95;
      duration = 30000;
      interruptible = false;
    } else if (remaining < 60000) {
      // 1分钟内 — 高紧急
      weight = 0.9;
      duration = Math.min(remaining, 30000);
      interruptible = false;
    } else if (remaining < 300000) {
      // 5分钟内 — 中紧急
      weight = 0.7;
      duration = Math.min(remaining, 60000);
      interruptible = true;
    } else {
      // 低紧急
      weight = 0.4;
      duration = 60000;
      interruptible = true;
    }

    const taskId = `urgent-${deadline}`;
    const schedule: AttentionSchedule = {
      taskId,
      attentionWeight: weight,
      focusDuration: duration,
      interruptible,
    };
    this.activeSchedules.set(taskId, schedule);
    return schedule;
  }

  /**
   * 批量调度任务 — 按优先级分配注意力权重
   *
   * 高优先级任务获得更高注意力权重和更长专注时间
   */
  schedule(tasks: SchedulableTask[]): AttentionSchedule[] {
    // 按优先级降序
    const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
    const results: AttentionSchedule[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const task = sorted[i]!;
      // 优先级越高注意力权重越大；随排名递减
      const rankFactor = sorted.length > 1 ? 1 - i / (sorted.length - 1) : 1;
      const weight = Math.max(0.1, Math.min(1, task.priority * rankFactor));
      const focusDuration = Math.floor(10000 + task.priority * 50000);
      const interruptible = task.priority < 0.7;

      const schedule: AttentionSchedule = {
        taskId: task.taskId,
        attentionWeight: Number(weight.toFixed(2)),
        focusDuration,
        interruptible,
      };
      this.activeSchedules.set(task.taskId, schedule);
      results.push(schedule);
    }

    return results;
  }

  /**
   * 获取当前活跃的调度列表
   */
  getActiveSchedules(): AttentionSchedule[] {
    return Array.from(this.activeSchedules.values());
  }
}
