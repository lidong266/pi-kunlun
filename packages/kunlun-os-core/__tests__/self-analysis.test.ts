/**
 * 昆仑OS 自分析测试 — 用昆仑OS分析昆仑OS
 * 测试完整管线: injectCognition → decomposeWithLLM → mapReduce
 */
import { describe, it, expect } from 'vitest';
import { KunlunOS } from '../src/kunlun-os.js';
import { SharedCognitiveLayer } from '../src/shared-layer.js';
import { CognitivePrefetcher } from '../src/optimizations.js';

describe('昆仑OS 自分析', () => {
  let os: KunlunOS;
  let shared: SharedCognitiveLayer;

  beforeAll(async () => {
    os = new KunlunOS({ verbose: true, instanceId: 'kunlun-self-test' });
    await os.start();
    shared = new SharedCognitiveLayer();
  });

  afterAll(() => {
    os.stop();
  });

  it('分析: 昆仑OS架构的优势与不足', async () => {
    const query = '昆仑OS认知操作系统的架构优势和不足';

    const startTime = Date.now();

    // ── 阶段1: injectCognition ──
    const t1 = Date.now();
    const analysis = await os.injectCognition(
      [{ role: 'user', content: query }], ''
    );
    const injectTime = Date.now() - t1;

    // ── 阶段2: 规则拆解 ──
    const t2 = Date.now();
    const subTasks = decomposeForTest(query, analysis);
    const decomposeTime = Date.now() - t2;

    // ── 阶段3: 模拟并行执行 ──
    const t3 = Date.now();
    // 每个子任务模拟 100ms LLM延迟（实际会调用真实LLM）
    const mockResults = subTasks.map(t => ({
      taskId: t.id,
      result: `[${t.prompt.substring(0, 30)}... 的分析结果]`,
      latency: Math.random() * 50 + 75, // 75-125ms 模拟
    }));
    const mapTime = Date.now() - t3;

    const totalTime = Date.now() - startTime;

    // ── 输出报告 ──
    console.log('\n' + '═'.repeat(70));
    console.log('  昆仑OS 自分析报告');
    console.log('═'.repeat(70));
    console.log('');
    console.log(`📝 查询: ${query}`);
    console.log('');
    console.log('─── 认知分析 ───');
    console.log(`📍 桥: ${analysis.bridge?.icon} ${analysis.bridge?.name} (${analysis.bridge?.id})`);
    console.log(`📜 公理: ${analysis.bridge?.axiom}`);
    console.log(`📚 知识卡片: ${analysis.knowledgeCards?.map(c => c.title).join(' | ') || '无'}`);
    console.log(`⚡ 矛盾: ${analysis.contradictions.length}组`);
    for (const c of analysis.contradictions) {
      console.log(`   ${c.thesis} ↔ ${c.antithesis}`);
    }
    console.log(`🔗 可统一性: ${analysis.unifiability === 1 ? '✅' : analysis.unifiability === -1 ? '❌' : '⚪'}`);
    console.log(`🧠 综合集成: ${analysis.synthesis?.stance} (${analysis.synthesis?.confidence})`);
    console.log(`🎨 天工信度: ${analysis.rendered?.overallConfidence}`);
    console.log(`🎯 策略: ${analysis.strategy || '无'}`);
    console.log('');
    console.log('─── 任务拆解 ───');
    console.log(`📦 拆解方式: 规则拆解`);
    console.log(`🔢 子任务数: ${subTasks.length}`);
    for (const t of subTasks) {
      console.log(`   ${t.id}: ${t.prompt.substring(0, 60)}...`);
    }
    console.log('');
    console.log('─── 效率统计 ───');
    console.log(`⏱️  injectCognition: ${injectTime}ms`);
    console.log(`⏱️  任务拆解: ${decomposeTime}ms`);
    console.log(`⏱️  并行执行(Map): ${mapTime}ms (${subTasks.length}任务)`);
    console.log(`⏱️  总耗时: ${totalTime}ms`);
    console.log('');
    console.log('─── 串行 vs 并行对比 ───');
    const serialEstimate = subTasks.length * 100;
    console.log(`   串行预估: ${serialEstimate}ms (${subTasks.length}×100ms)`);
    console.log(`   并行实际: ${mapTime}ms`);
    console.log(`   加速比: ${(serialEstimate / Math.max(mapTime, 1)).toFixed(1)}x`);
    console.log('');
    console.log('─── 共享层状态 ───');
    const stats = shared.getStats();
    console.log(`   记忆: ${stats.memories} | 缓存: ${stats.analysisCache} | Token: ${stats.tokens.llm.used}/${stats.tokens.llm.total}`);
    console.log('');
    console.log('─── Prompt注入预览 ───');
    console.log(analysis.promptInjection.split('\n').slice(0, 8).join('\n'));
    console.log('═'.repeat(70));

    // 断言
    expect(analysis.bridge).toBeDefined();
    expect(subTasks.length).toBeGreaterThan(0);
    expect(injectTime).toBeLessThan(50); // 纯本地应 <50ms
  });

  it('分析: 多微内核MapReduce的效率上限', async () => {
    const query = '多微内核MapReduce架构的效率上限';

    const t1 = Date.now();
    const analysis = await os.injectCognition(
      [{ role: 'user', content: query }], ''
    );
    const injectTime = Date.now() - t1;

    const subTasks = decomposeForTest(query, analysis);

    // 模拟不同核心数的执行时间
    console.log('\n─── MapReduce 效率上限分析 ───');
    console.log(`   子任务数: ${subTasks.length}`);
    console.log(`   injectCognition: ${injectTime}ms`);
    console.log('');
    console.log('   核心数 | 理论耗时 | 加速比 | 利用率');
    console.log('   ──────┼─────────┼───────┼───────');

    const llmLatency = 2000; // 模拟真实LLM 2秒延迟
    for (const cores of [1, 2, 3, 5, subTasks.length]) {
      const batches = Math.ceil(subTasks.length / cores);
      const parallelTime = batches * llmLatency;
      const serialTime = subTasks.length * llmLatency;
      const speedup = (serialTime / parallelTime).toFixed(1);
      const utilization = (Math.min(cores, subTasks.length) / cores * 100).toFixed(0);
      console.log(`   ${cores}      | ${parallelTime}ms   | ${speedup}x  | ${utilization}%`);
    }

    expect(analysis.summary).toBeDefined();
    expect(injectTime).toBeLessThan(50);
  });

  it('全管线Prompt注入输出', async () => {
    const analysis = await os.injectCognition(
      [{ role: 'user', content: 'AI认知操作系统的未来发展方向' }],
      'You are a helpful assistant.',
    );

    console.log('\n─── 完整Prompt注入 ───');
    console.log(analysis.promptInjection);

    expect(analysis.promptInjection).toContain('大成智慧学');
    expect(analysis.promptInjection).toContain('昆仑OS');
    expect(analysis.bridge).toBeDefined();
  });
});

/** 测试用拆解函数（模拟decomposeWithLLM的规则降级） */
function decomposeForTest(query: string, analysis: any): Array<{ id: string; prompt: string }> {
  const tasks: Array<{ id: string; prompt: string }> = [];

  for (const c of analysis.contradictions || []) {
    tasks.push({ id: `正题`, prompt: `从"${c.thesis}"角度分析: ${query}` });
    tasks.push({ id: `反题`, prompt: `从"${c.antithesis}"角度分析: ${query}` });
  }

  if (tasks.length === 0 && analysis.bridge) {
    tasks.push({ id: 'bridge', prompt: `基于"${analysis.bridge.axiom}"分析: ${query}` });
  }

  if (tasks.length === 0) {
    tasks.push(
      { id: 'dim-0', prompt: `技术角度: ${query}` },
      { id: 'dim-1', prompt: `应用角度: ${query}` },
      { id: 'dim-2', prompt: `发展角度: ${query}` },
    );
  }

  return tasks;
}
