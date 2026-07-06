/**
 * CognitiveCLI — 离线认知分析命令行（无需 LLM API）
 *
 * 暴露昆仑OS 的核心认知能力，无需 LLM API Key 即可使用：
 *
 *   analyze <text>            大成智慧学认知管线（十一桥 → 矛盾 → 综合集成 → 天工渲染）
 *   contradiction <A> vs <B>  矛盾分析引擎（8 分析器逐对分析）
 *   bridge <text>             十一桥路由与知识卡片
 *   boot                      CogBoot 6 阶段引导序列
 *   status                    OS 运行状态
 *   bridges                   列出全部十一桥
 *   help                      显示帮助
 *
 * 使用方式：
 *   一键执行：  npx tsx packages/kunlun-os-core/src/cognitive-cli.ts analyze "性能和成本如何权衡"
 *   交互模式：  npx tsx packages/kunlun-os-core/src/cognitive-cli.ts
 *
 * 也可通过 kl 入口调用：
 *   node packages/kunlun-os-core/bin/kunlun.mjs analyze "性能和成本如何权衡"
 */

import * as readline from 'node:readline';
import { KunlunOS } from './kunlun-os.js';
import type { KunlunAnalysis } from './kunlun-os.js';
import {
  routeToBridge,
  getBridgeCards,
  getBridgeAxiom,
  ELEVEN_BRIDGES,
  type BridgeProfile,
  type KnowledgeCard,
} from './eleven-bridges.js';
import { createContradictionEngine } from '@kunlun/contradiction';
import type { ContradictionPair, Proposition, Evidence, ContradictionAnalysisOutput } from '@kunlun/contradiction';
import { T_TRUE, T_FALSE, T_UNKNOWN, TRYTE_ZERO } from '@kunlun/ternary';
import type { Trit, Tryte } from '@kunlun/ternary';
import { OS_VERSION } from './boot-animation.js';

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function tritLabel(t: Trit): string {
  if (t === 1) return '✅ 正（+1）';
  if (t === -1) return '❌ 负（-1）';
  return '⭕ 中立/未知（0）';
}

function tritSymbol(t: Trit): string {
  if (t === 1) return '✅';
  if (t === -1) return '❌';
  return '⭕';
}

function unifiabilityLabel(t: Trit): string {
  if (t === 1) return '可统一 ✅';
  if (t === -1) return '不可调和 ❌';
  return '待分析 ⚪';
}

function dominantLabel(t: Trit): string {
  if (t === 1) return '正题主导';
  if (t === -1) return '反题主导';
  return '均势';
}

function separator(title: string): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function line(char = '─', len = 60): void {
  console.log(char.repeat(len));
}

// ─── 构造矛盾分析所需的最小对象 ──────────────────────────────

function makeEvidence(id: string, content: string, strength: number): Evidence {
  return {
    type: 'empirical' as const,
    content,
    strength: strength as any,
    source: `cli-${id}`,
    timestamp: Date.now(),
  };
}

function makeProposition(
  id: string,
  statement: string,
  domain: string,
): Proposition {
  return {
    id,
    statement,
    domain,
    evidence: [makeEvidence(id, '用户提供的命题', 1)],
    counterEvidence: [],
    confidenceTrit: T_UNKNOWN,
    confidenceVector: TRYTE_ZERO,
    source: { type: 'perception', signalId: 'cli' } as any,
    dependencies: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makePair(thesis: string, antithesis: string, domain: string): ContradictionPair {
  const id = `cli-${Date.now()}`;
  return {
    id,
    thesis: makeProposition('th', thesis, domain),
    antithesis: makeProposition('at', antithesis, domain),
    contradictionType: 'non_antagonistic',
    discoveredBy: 'diting_perception' as any,
    discoveredAt: Date.now(),
    relatedContradictions: [],
    priority: 0.5,
    presenceStateAtDiscovery: { phase: 'observation', actors: [], focus: id } as any,
    warPhaseAtDiscovery: 'strategic_defense',
  };
}

// ═══════════════════════════════════════════════════════════════
// CognitiveCLI 主类
// ═══════════════════════════════════════════════════════════════

export class CognitiveCLI {
  private os: KunlunOS;
  private rl: readline.Interface | null = null;
  private running = false;

  constructor() {
    this.os = new KunlunOS({ verbose: false });
  }

  /** 确保 OS 已启动 */
  private async ensureStarted(): Promise<KunlunOS> {
    if (!this.os.isRunning()) {
      await this.os.start();
    }
    return this.os;
  }

  // ─── 一键命令执行 ──────────────────────────────────────────

  /**
   * 执行单条命令并退出（非交互模式）
   * @returns 0 表示成功，1 表示失败/用法错误
   */
  async runCommand(cmd: string, args: string[]): Promise<number> {
    try {
      switch (cmd) {
        case 'analyze':
          return await this.cmdAnalyze(args.join(' '));
        case 'contradiction':
          return await this.cmdContradiction(args);
        case 'bridge':
          return await this.cmdBridge(args.join(' '));
        case 'bridges':
          this.cmdBridges();
          return 0;
        case 'boot':
          return await this.cmdBoot();
        case 'status':
          return await this.cmdStatus();
        case 'help':
        case '--help':
        case '-h':
          this.printHelp();
          return 0;
        case 'version':
        case '--version':
        case '-v':
          console.log(`昆仑OS (KunlunOS) Cognitive CLI v${OS_VERSION}`);
          return 0;
        default:
          console.error(`未知命令: ${cmd}`);
          this.printHelp();
          return 1;
      }
    } catch (err) {
      console.error('\n❌ 执行失败:', err instanceof Error ? err.message : String(err));
      return 1;
    } finally {
      this.os.stop();
    }
  }

  // ─── 交互式 REPL ───────────────────────────────────────────

  /** 启动交互式离线 REPL */
  async startRepl(): Promise<void> {
    await this.ensureStarted();
    this.printBanner();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\n🐉 认知> ',
    });

    this.running = true;
    this.rl.prompt();

    this.rl.on('line', async (input: string) => {
      const text = input.trim();
      if (!text) {
        if (this.running) this.rl!.prompt();
        return;
      }

      if (text.startsWith('/')) {
        await this.runCommand(text.slice(1).split(/\s+/)[0] ?? 'help', text.slice(1).split(/\s+/).slice(1));
      } else {
        // 无斜杠直接当作 analyze
        await this.cmdAnalyze(text);
      }

      if (this.running) this.rl!.prompt();
    });

    this.rl.on('close', () => {
      this.running = false;
      this.shutdown();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 命令实现
  // ═══════════════════════════════════════════════════════════════

  /** /analyze <text> — 大成智慧学认知管线 */
  private async cmdAnalyze(text: string): Promise<number> {
    if (!text) {
      console.log('用法: analyze <文本>');
      console.log('示例: analyze 性能和成本如何权衡');
      return 1;
    }

    const os = await this.ensureStarted();
    const analysis: KunlunAnalysis = await os.injectCognition(
      [{ role: 'user', content: text }],
      'offline cognitive analysis',
    );

    this.printAnalysis(analysis, text);
    return 0;
  }

  /** /contradiction <A> vs <B> — 矛盾分析引擎（8 分析器） */
  private async cmdContradiction(args: string[]): Promise<number> {
    const joined = args.join(' ');
    // 支持 "A vs B" / "A VS B" / "A vs. B"
    const vsMatch = joined.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
    if (!vsMatch) {
      console.log('用法: contradiction <正题> vs <反题>');
      console.log('示例: contradiction 追求极致性能 vs 严格控制成本');
      console.log('      contradiction "快速迭代" vs "质量保障"');
      return 1;
    }

    const thesis = vsMatch[1]!.trim().replace(/^["']|["']$/g, '');
    const antithesis = vsMatch[2]!.trim().replace(/^["']|["']$/g, '');

    if (!thesis || !antithesis) {
      console.error('❌ 正题和反题不能为空');
      return 1;
    }

    // 路由桥以确定领域
    const bridge = routeToBridge(`${thesis} ${antithesis}`);
    const domain = bridge.name;

    const engine = createContradictionEngine();
    const pair = makePair(thesis, antithesis, domain);
    const result: ContradictionAnalysisOutput = engine.analyzeSingle(pair);

    this.printContradictionResult(result, thesis, antithesis, bridge);
    return 0;
  }

  /** /bridge <text> — 十一桥路由与知识卡片 */
  private async cmdBridge(text: string): Promise<number> {
    if (!text) {
      console.log('用法: bridge <文本>');
      console.log('示例: bridge 如何优化系统性能');
      return 1;
    }

    const bridge = routeToBridge(text);
    const axiom = getBridgeAxiom(bridge.id);
    const cards = getBridgeCards(bridge.id);

    separator(`${bridge.icon} ${bridge.id} · ${bridge.name}桥`);
    console.log(`  英文名:  ${bridge.en}`);
    console.log(`  核心公理: ${axiom}`);
    console.log(`  关键词:   ${bridge.keywords.slice(0, 8).join('、')}`);

    console.log('\n📚 知识卡片（三层）:');
    for (const card of cards) {
      console.log('');
      console.log(`  ┌─ ${card.id} [${card.type}] ${card.layer}`);
      console.log(`  │ 标题: ${card.title}`);
      console.log(`  │ 内容: ${card.content}`);
      console.log(`  └─ 标签: ${card.tags.join(', ')}`);
    }

    console.log('\n💡 三环节使用法:');
    console.log('   感知 → 用卡片拆解命题');
    console.log('   思考 → 用卡片重组推理');
    console.log('   表达 → 用卡片梳理输出');
    return 0;
  }

  /** /bridges — 列出全部十一桥 */
  private cmdBridges(): void {
    separator('十一桥知识体系（大成智慧学）');
    console.log('  马克思主义哲学 → 十一座学科桥梁 → 三层卡片（AX公理/SC学科/TC工具）\n');
    for (const b of ELEVEN_BRIDGES) {
      console.log(`  ${b.icon} ${b.id}  ${b.name}  (${b.en})`);
      console.log(`       公理: ${b.axiom}`);
      console.log(`       卡片: ${b.cards.map(c => `${c.id} ${c.title}`).join(' | ')}`);
      console.log('');
    }
    console.log(`  共 ${ELEVEN_BRIDGES.length} 座桥，${ELEVEN_BRIDGES.reduce((s, b) => s + b.cards.length, 0)} 张知识卡片`);
  }

  /** /boot — CogBoot 6 阶段引导序列 */
  private async cmdBoot(): Promise<number> {
    const os = await this.ensureStarted();
    const cfg = os.getConfig();
    const animated = process.stdout.isTTY === true && cfg.showBootAnim !== false;

    // 动画模式（TTY + showBootAnim）：CogBoot.start() 内部的 BootAnimator 已显示完整动画，避免重复输出
    if (animated) {
      return 0;
    }

    // 文本降级模式：手动打印引导序列
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  昆仑OS — CogBoot 6 阶段引导序列                         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    const logs = os.getBootLogs();

    console.log('');
    for (const log of logs) {
      const icon = log.status === 'success' ? '✅' : '❌';
      console.log(`  ${icon} [阶段${log.phase}] ${log.name} — ${log.message} (${log.duration}ms)`);
    }

    const state = os.getState();
    console.log('');
    line();
    console.log(`  引导完成: 状态=${state.status} | 实例=${state.instanceCount} | 算法插件已注册`);
    console.log(`  调度器: ${os.getScheduler().getInstanceIds().length} 个认知实例`);
    console.log(`  算法注册表: ${os.getAlgoRegistry().listAlgorithms().length} 个插件`);
    console.log(`    ${os.getAlgoRegistry().listAlgorithms().map((a: any) => a.name ?? a).join(' · ')}`);
    return 0;
  }

  /** /status — OS 运行状态 */
  private async cmdStatus(): Promise<number> {
    const os = await this.ensureStarted();
    const state = os.getState();

    separator('昆仑OS 运行状态');
    console.log(`  运行状态:   ${state.status}`);
    console.log(`  运行时间:   ${Math.floor(state.uptime / 1000)}s`);
    console.log(`  认知实例:   ${state.instanceCount}`);
    console.log(`  任务队列:   ${state.taskCount}`);
    console.log(`  管道运行:   ${state.pipelineRuns}`);

    try {
      const scheduler = os.getScheduler();
      const tasks = scheduler.getTasks();
      if (tasks.length > 0) {
        console.log('\n  当前任务:');
        for (const t of tasks.slice(0, 10)) {
          console.log(`    · ${typeof t === 'object' ? (t.id ?? JSON.stringify(t).slice(0, 60)) : t}`);
        }
      }
    } catch { /* ignore */ }

    return 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // 输出格式化
  // ═══════════════════════════════════════════════════════════════

  /** 打印认知分析结果（injectCognition 输出） */
  private printAnalysis(a: KunlunAnalysis, query: string): void {
    separator('🧠 大成智慧学·认知分析');

    console.log(`\n📝 输入: ${query}`);

    // 十一桥路由
    if (a.bridge) {
      console.log('\n【十一桥路由】');
      console.log(`  ${a.bridge.icon} ${a.bridge.id} · ${a.bridge.name}桥`);
      console.log(`  公理: ${a.bridge.axiom}`);
    }

    // 知识卡片
    if (a.knowledgeCards && a.knowledgeCards.length > 0) {
      console.log('\n【知识卡片】');
      for (const c of a.knowledgeCards) {
        console.log(`  · ${c.id} [${c.type}] ${c.title}`);
      }
    }

    // 矛盾感知
    if (a.contradictions.length > 0) {
      console.log('\n【矛盾感知】');
      for (const c of a.contradictions) {
        console.log(`  · ${c.thesis} ↔ ${c.antithesis}`);
      }
      console.log(`  可统一性: ${unifiabilityLabel(a.unifiability)}`);
      console.log(`  主导方面: ${dominantLabel(a.dominantAspect)}`);
    } else {
      console.log('\n【矛盾感知】未检测到显式矛盾');
    }

    // 综合集成
    if (a.synthesis) {
      console.log('\n【综合集成·大成智慧学】');
      console.log(`  共识立场: ${a.synthesis.stance}`);
      console.log(`  置信度:   ${a.synthesis.confidence}`);
    }

    // 天工渲染
    if (a.rendered) {
      console.log('\n【天工渲染·三元信度】');
      console.log(`  整体信度: ${a.rendered.overallConfidence}`);
      console.log(`  ${a.rendered.summary}`);
    }

    // 策略
    if (a.strategy) {
      console.log('\n【策略建议】');
      console.log(`  ${a.strategy}`);
    }

    // 摘要
    console.log('\n【分析摘要】');
    console.log(`  ${a.summary}`);

    // prompt 注入（供 LLM 使用）
    if (a.promptInjection) {
      console.log('\n【Prompt 注入文本】(可注入 LLM system prompt)');
      console.log(a.promptInjection);
    }

    console.log('\n✅ 分析完成 — 以上全部基于本地三进制计算，无需 LLM API。');
  }

  /** 打印矛盾引擎分析结果（8 分析器） */
  private printContradictionResult(
    r: ContradictionAnalysisOutput,
    thesis: string,
    antithesis: string,
    bridge: BridgeProfile,
  ): void {
    separator('⚔️ 矛盾分析引擎（8 分析器）');

    console.log('\n📋 矛盾对:');
    console.log(`  正题: ${thesis}`);
    console.log(`  反题: ${antithesis}`);
    console.log(`  领域: ${bridge.icon} ${bridge.name}桥`);

    // 核心三元素
    console.log('\n📊 核心分析:');
    console.log(`  可统一性: ${tritLabel(r.analysis.unifiability)}`);
    console.log(`  主导方面: ${tritLabel(r.analysis.dominantAspect)}`);
    if ((r.analysis as any).contradictionType) {
      console.log(`  矛盾类型: ${(r.analysis as any).contradictionType}`);
    }
    const paths = (r.analysis as any).unificationPaths;
    if (Array.isArray(paths) && paths.length > 0) {
      console.log('  统一路径:');
      for (const p of paths.slice(0, 3)) {
        const desc = typeof p === 'object' ? (p.description || p.path || JSON.stringify(p).slice(0, 80)) : String(p);
        console.log(`    → ${desc}`);
      }
    }

    // 质变临界点
    console.log('\n📈 质变临界点:');
    console.log(`  临界状态:       ${tritLabel(r.qualitativeChange.approachingThreshold)}`);
    const accum = r.qualitativeChange.quantitativeAccumulation;
    console.log(`  量变积累程度:   ${isNaN(accum) ? 'N/A' : (accum * 100).toFixed(1) + '%'}`);
    const triggers = r.qualitativeChange.triggers;
    if (Array.isArray(triggers) && triggers.length > 0) {
      console.log('  可能触发因素:');
      for (const t of triggers.slice(0, 3)) {
        const desc = typeof t === 'object' ? ((t as any).description || (t as any).factor || JSON.stringify(t).slice(0, 80)) : String(t);
        console.log(`    → ${desc}`);
      }
    }

    // 否定之否定
    console.log('\n🔄 否定之否定:');
    console.log(`  当前阶段:   ${tritLabel(r.negationCycle.stage)}`);
    console.log(`  螺旋上升:   ${r.negationCycle.isGenuineAscension ? '是 ✅' : '否'}`);
    const emergent = r.negationCycle.emergentProperties;
    if (Array.isArray(emergent) && emergent.length > 0) {
      console.log('  涌现新属性:');
      for (const p of emergent.slice(0, 3)) {
        console.log(`    → ${p}`);
      }
    }

    // 转化预测
    console.log('\n🔮 矛盾转化预测:');
    const pred = r.transformationPrediction as any;
    if (pred.resultingContradiction) {
      const rc = pred.resultingContradiction as any;
      console.log(`  转化后矛盾: ${rc.thesis?.statement ?? rc.statement ?? 'N/A'}`);
    }
    const prob = pred.probability;
    console.log(`  转化概率:   ${isNaN(prob) ? 'N/A' : (prob * 100).toFixed(1) + '%'}`);
    if (Array.isArray(pred.conditions) && pred.conditions.length > 0) {
      console.log('  转化条件:');
      for (const c of pred.conditions.slice(0, 3)) {
        console.log(`    → ${c}`);
      }
    }

    // 三进制编码
    console.log('\n🔢 三进制编码 (统一性/主导/临界):');
    const u = r.analysis.unifiability;
    const d = r.analysis.dominantAspect;
    const q = r.qualitativeChange.approachingThreshold;
    const code = `${u >= 0 ? '+' : ''}${u}/${d >= 0 ? '+' : ''}${d}/${q >= 0 ? '+' : ''}${q}`;
    console.log(`  ${tritSymbol(u)} ${tritSymbol(d)} ${tritSymbol(q)}  →  ${code}`);

    console.log('\n✅ 矛盾分析完成 — 8 个分析器全部基于本地三进制计算，无需 LLM API。');
  }

  // ═══════════════════════════════════════════════════════════════
  // 帮助与横幅
  // ═══════════════════════════════════════════════════════════════

  private printBanner(): void {
    const state = this.os.getState();
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  昆仑OS — 离线认知分析 CLI');
    console.log('  大成智慧学 · 矛盾论 · 三进制认知');
    console.log('  ⚡ 无需 LLM API，纯本地三进制计算');
    console.log('═══════════════════════════════════════════');
    console.log(`  状态: ${state.status} | 实例: ${state.instanceCount}`);
    console.log('  输入 /help 查看命令 | 直接输入文本即认知分析');
    console.log('═══════════════════════════════════════════');
  }

  printHelp(): void {
    console.log('');
    console.log('昆仑OS 离线认知分析 CLI — 命令列表:');
    console.log('');
    console.log('  analyze <文本>                  大成智慧学认知管线');
    console.log('                                  (十一桥 → 矛盾 → 综合集成 → 天工渲染)');
    console.log('  contradiction <正题> vs <反题>  矛盾分析引擎（8 分析器）');
    console.log('  bridge <文本>                   十一桥路由与知识卡片');
    console.log('  bridges                         列出全部十一桥');
    console.log('  boot                            CogBoot 6 阶段引导序列');
    console.log('  status                          OS 运行状态');
    console.log('  help                            显示此帮助');
    console.log('  version                         显示版本');
    console.log('  exit                            退出（交互模式）');
    console.log('');
    console.log('示例:');
    console.log('  kl analyze "性能和成本如何权衡"');
    console.log('  kl contradiction "追求性能" vs "保证成本"');
    console.log('  kl bridge "如何优化系统架构"');
    console.log('  kl boot');
    console.log('');
    console.log('交互模式中，直接输入文本等同于 analyze。');
  }

  private shutdown(): void {
    console.log('\n👋 昆仑OS 认知 CLI 正在关闭...');
    this.os.stop();
    if (this.rl) this.rl.close();
    this.running = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 直接运行入口
// ═══════════════════════════════════════════════════════════════

/**
 * 解析 argv 并执行
 *   无参数 → 交互式 REPL
 *   有参数 → 单命令执行后退出
 */
export async function runCognitiveCli(argv: string[]): Promise<number> {
  const cli = new CognitiveCLI();

  if (argv.length === 0) {
    await cli.startRepl();
    return 0;
  }

  const cmd = argv[0]!;
  const args = argv.slice(1);
  return cli.runCommand(cmd, args);
}

// ═══════════════════════════════════════════════════════════════
// 直接执行入口（CLI 模式）
// ═══════════════════════════════════════════════════════════════

// 当通过 npx tsx / node 直接运行此文件时自动执行
// （测试环境 VITEST=true 时跳过快照执行，避免污染测试导致 process.exit）
if (
  process.env.VITEST !== 'true' &&
  process.argv[1] && (
    process.argv[1].endsWith('.ts') ||
    process.argv[1].endsWith('.mjs') ||
    process.argv[1].endsWith('.js')
  )
) {
  const args = process.argv.slice(2);
  runCognitiveCli(args).then((code) => {
    process.exit(code);
  }).catch((err) => {
    console.error('昆仑OS CLI 启动失败:', err.message);
    process.exit(1);
  });
}
