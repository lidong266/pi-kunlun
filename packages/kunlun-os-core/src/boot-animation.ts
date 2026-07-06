/**
 * BootAnimator — 昆仑OS 终端启动动画
 *
 * 灵感来源：鸿蒙6 系统启动动画，简洁现代风格
 * 使用 ANSI 转义码实现彩色终端输出和阶段进度动画
 *
 * 特性：
 *   - 彩色 ASCII Logo（青色/金色主题）
 *   - 6阶段引导进度动画
 *   - 非TTY环境自动降级为纯文本输出
 *   - 启动完成统计摘要
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ═══════════════════════════════════════════════════════════════
// ANSI 颜色常量
// ═══════════════════════════════════════════════════════════════

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  cyanBright: '\x1b[96m',
  blue: '\x1b[34m',
  blueBright: '\x1b[94m',
  gold: '\x1b[33m',
  goldBright: '\x1b[93m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/**
 * 版本号：从仓库根 package.json 动态读取，避免硬编码导致启动动画显示错误版本。
 * 仓库根 package.json 的 name 为 "pi-kunlun"，其 version 即昆仑OS 发布版本号。
 */
function resolveOsVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkgPath = join(dir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string };
      if (pkg.name === 'pi-kunlun' && pkg.version) return pkg.version;
    } catch {
      // 该层无 package.json 或读取失败，继续向上查找
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.9.0';
}

/** 昆仑OS 版本号（来自根 package.json，单一事实来源） */
export const OS_VERSION = resolveOsVersion();
const VERSION = OS_VERSION;
const BOX_WIDTH = 50;

/** 阶段名称映射 */
const PHASE_NAMES: Record<number, string> = {
  0: 'IPC + Memory Pool',
  1: 'Scheduler + GC',
  2: 'Trust Framework',
  3: 'Capability Registry',
  4: 'Cognitive Bus',
  5: 'Algorithm Engines',
};

// ═══════════════════════════════════════════════════════════════
// BootAnimator
// ═══════════════════════════════════════════════════════════════

export class BootAnimator {
  private enabled: boolean;
  private isTTY: boolean;
  private phaseCount = 0;

  /** 是否显示启动动画 */
  constructor(showAnim = true) {
    this.isTTY = typeof process !== 'undefined' &&
      process.stdout !== undefined &&
      (process.stdout as { isTTY?: boolean }).isTTY === true;
    this.enabled = showAnim && this.isTTY;
  }

  /** 检查动画是否启用 */
  get isEnabled(): boolean {
    return this.enabled;
  }

  // ─── 内部工具 ──────────────────────────────────

  private write(text: string): void {
    process.stdout.write(text);
  }

  private writeln(text: string): void {
    process.stdout.write(text + '\n');
  }

  private box(content: string, color: string = C.white): string {
    const pad = Math.max(0, BOX_WIDTH - content.length - 2);
    const leftPad = Math.floor(pad / 2);
    const rightPad = pad - leftPad;
    return `${color}┃${C.reset} ${' '.repeat(leftPad)}${content}${' '.repeat(rightPad)} ${color}┃${C.reset}`;
  }

  private centerLine(text: string, color: string = C.white): string {
    const pad = Math.max(0, BOX_WIDTH - text.length);
    const leftPad = Math.floor(pad / 2);
    return ' '.repeat(leftPad) + `${color}${text}${C.reset}`;
  }

  // ─── Logo ──────────────────────────────────────

  showLogo(): void {
    if (!this.enabled) return;

    this.write('\n');
    this.writeln(`${C.gold}${C.bold}╔══════════════════════════════════════════════════╗${C.reset}`);
    this.writeln(`${C.gold}║${C.reset}                                                  ${C.gold}║${C.reset}`);
    this.writeln(this.centerLine(`${C.cyanBright}${C.bold}    ╦╔═ ╦ ╦ ╔╗╔ ╦  ╦ ╦ ╔╗╔   ╔═╗ ╔═╗${C.reset}`, C.white));
    this.writeln(this.centerLine(`${C.cyanBright}${C.bold}    ╠╩╗ ║ ║ ║║║ ║  ║ ║ ║║║   ║ ║ ╚═╗${C.reset}`, C.white));
    this.writeln(this.centerLine(`${C.cyanBright}${C.bold}    ╩ ╩ ╚═╝ ╝╚╝ ╩═╝ ╚═╝ ╝╚╝   ╚═╝ ╚═╝${C.reset}`, C.white));
    this.writeln(`${C.gold}║${C.reset}                                                  ${C.gold}║${C.reset}`);
    this.writeln(this.centerLine(`${C.dim}Cognitive Operating System${C.reset}`, C.gray));
    this.writeln(this.centerLine(`${C.gold}v${VERSION}${C.reset}`, C.gold));
    this.writeln(`${C.gold}║${C.reset}                                                  ${C.gold}║${C.reset}`);
    this.writeln(`${C.gold}╚══════════════════════════════════════════════════╝${C.reset}`);
    this.write('\n');

    // 子系统和特性提示
    this.writeln(`  ${C.cyan}▸${C.reset} ${C.dim}Multi-Kernel MapReduce Scheduler${C.reset}`);
    this.writeln(`  ${C.cyan}▸${C.reset} ${C.dim}Eleven Bridges Knowledge System${C.reset}`);
    this.writeln(`  ${C.cyan}▸${C.reset} ${C.dim}Cognitive Bus + Insight Event Bus${C.reset}`);
    this.writeln(`  ${C.cyan}▸${C.reset} ${C.dim}Meta-Synthesis Workshop${C.reset}`);
    this.write('\n');

    // 阶段标题
    this.writeln(`  ${C.cyan}┌── Boot Phases ${C.dim}────────────────────────────────────────┐${C.reset}`);
  }

  // ─── 阶段动画 ──────────────────────────────────

  startPhase(phase: number): void {
    if (!this.enabled) return;
    this.phaseCount++;

    const name = PHASE_NAMES[phase] ?? `Phase ${phase}`;
    const phaseLabel = `phase${phase}`.padEnd(7, ' ');
    this.write(`  ${C.cyan}│${C.reset} ${C.dim}${phaseLabel}${C.reset} ${name} ${C.dim}${'.'.repeat(3)}${C.reset}`);
  }

  completePhase(phase: number, status: 'success' | 'error'): void {
    if (!this.enabled) return;

    const icon = status === 'success'
      ? `${C.green}✓${C.reset}`
      : `${C.red}✗${C.reset}`;

    // 覆写 spinner 部分（3个点 + 空格）
    this.write(`\r  ${C.cyan}│${C.reset} ${C.dim}phase${phase}${' '.repeat(2)}${C.reset} ${PHASE_NAMES[phase] ?? `Phase ${phase}`}`);
    // 填充到固定宽度再显示图标
    const name = PHASE_NAMES[phase] ?? `Phase ${phase}`;
    const label = `phase${phase}`.padEnd(7, ' ');
    const line = `${label} ${name}`;
    const padCount = Math.max(0, 38 - line.length);
    this.write(`${' '.repeat(padCount)} ${icon}\n`);
  }

  // ─── 启动完成 ──────────────────────────────────

  showBootComplete(stats: {
    durationMs: number;
    phaseCount: number;
    subsystemCount: number;
    instanceIds: string[];
  }): void {
    if (!this.enabled) return;

    this.write('\n');
    this.writeln(`  ${C.cyan}└──────────────────────────────────────────────────────────┘${C.reset}`);
    this.write('\n');

    // 成功横幅
    this.writeln(`${C.green}${C.bold}  ✓ Boot Complete${C.reset}`);
    this.write('\n');

    // 统计信息
    const durationSec = (stats.durationMs / 1000).toFixed(2);
    this.writeln(`  ${C.dim}Duration:        ${C.reset}${C.gold}${durationSec}s${C.reset}`);
    this.writeln(`  ${C.dim}Phases:          ${C.reset}${stats.phaseCount} ${C.dim}(all OK)${C.reset}`);
    this.writeln(`  ${C.dim}Subsystems:      ${C.reset}${stats.subsystemCount}`);
    this.writeln(`  ${C.dim}Instances:       ${C.reset}${stats.instanceIds.length}`);
    this.write('\n');

    // 底部线
    this.writeln(`  ${C.gray}KunlunOS ${VERSION} — Ready for cognitive tasks${C.reset}`);
    this.write('\n');
  }

  // ─── 纯文本降级模式 ─────────────────────────────

  showLogoText(): void {
    if (this.enabled) return; // 如果TTY模式已处理，跳过

    console.log(`\n[KunlunOS] Cognitive Operating System v${VERSION}`);
    console.log('[KunlunOS] Multi-Kernel MapReduce Scheduler');
    console.log('[KunlunOS] Eleven Bridges Knowledge System\n');
  }

  completePhaseText(phase: number, status: 'success' | 'error'): void {
    if (this.enabled) return;

    const icon = status === 'success' ? '✓' : '✗';
    const name = PHASE_NAMES[phase] ?? `Phase ${phase}`;
    console.log(`[KunlunOS] phase${phase} ${name} [${icon}]`);
  }

  showBootCompleteText(stats: {
    durationMs: number;
    phaseCount: number;
    subsystemCount: number;
    instanceIds: string[];
  }): void {
    if (this.enabled) return;

    const durationSec = (stats.durationMs / 1000).toFixed(2);
    console.log(`\n[KunlunOS] Boot complete in ${durationSec}s`);
    console.log(`[KunlunOS] ${stats.phaseCount} phases, ${stats.subsystemCount} subsystems, ${stats.instanceIds.length} instances`);
    console.log(`[KunlunOS] Ready.\n`);
  }

  // ─── 错误处理 ──────────────────────────────────

  showBootError(error: Error): void {
    if (!this.enabled) {
      console.error(`[KunlunOS] Boot failed: ${error.message}`);
      return;
    }
    this.write('\n');
    this.writeln(`  ${C.red}${C.bold}✗ Boot Failed${C.reset}`);
    this.writeln(`  ${C.red}${error.message}${C.reset}`);
    this.write('\n');
  }
}
