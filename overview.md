# KunlunOS 微内核利用率优化 — v4 → v5 迭代总结

## v5 新增：OpenHarmony 6 启发落地 (batchInjectContext + InsightEventBus)

### 1. 批处理上下文注入 `batchInjectContext()`
- **文件**: `shared-layer.ts`
- `batchInjectContext(query, options)` — 统一入口格式化共享洞察
- `compact` 格式（Map阶段）：简洁编号列表
- `detailed` 格式（Reduce阶段）：含摘要+关键发现
- **替代**: `multi-kernel.ts` 中两处碎片化 `filter(Boolean).join('\n')` 拼接

### 2. Worker 事件总线 `InsightEventBus`
- **新文件**: `insight-bus.ts`
- 订阅/广播/getSince/getRecent — 跨核洞察主动通知
- `publishWorkerResult` 后自动广播 `KeyFindingEvent`
- 广播者自身不收到事件（避免回声）
- KunlunOS 版"跨核中断信号"

### 代码改动
| 文件 | 变化 |
|------|------|
| `insight-bus.ts` (新) | +106 行 |
| `shared-layer.ts` | +34 行 (batchInjectContext + eventBus 集成) |
| `multi-kernel.ts` | -16/+6 行 (替换碎片化拼接) |
| `index.ts` | +4 行 (导出 InsightEventBus) |
| `multi-kernel-efficiency.test.ts` | +80 行 (8 新测试) |
| **总计** | 5 文件, +246/-16 行 |

---

## v4：并发控制 + 流式增量 Reduce

### 1. 并发控制 (ConcurrencyController)
- **文件**: `packages/kunlun-os-core/src/optimizations.ts`
- 新增 `ConcurrencyController` 类：Promise 信号量模式
- 防止 Map 阶段子任务数 > Worker 数时，同时发起过多 LLM 请求
- `mapReduce` 新增 `options.maxConcurrency` 参数，默认 = workers 数量
- 返回 `concurrencyStats`（max/peak/avgWaiters）方便监控

### 2. 流式增量 Reduce (StreamReduceCollector v2)
- **文件**: `packages/kunlun-os-core/src/optimizations.ts`
- `StreamReduceCollector` 新增 `setPartialResultCallback()` 方法
- 每完成一个 Worker 立即触发回调，而非等全部完成
- 新增 `getPartialResults()` 获取当前快照
- 新增 `completedIndices` 属性追踪完成进度

### 3. 跨 Worker 知识传递（mapReduce 核心改进）
- **文件**: `packages/kunlun-os-core/src/multi-kernel.ts` → v3 → v4
- `mapReduce` 新增 `options.partialReduce`（默认 `true`）
- Worker 完成后立即通过 `StreamReduceCollector.onPartialResult` 发布洞察到共享层
- 后续 Worker 在 `acquire()` 槽位后，自动从共享层获取已完成的洞察并注入 prompt
- 实现了真正的跨核知识传递：先完成的分析结果直接提升后完成的分析质量

## 架构变化

```
v3: subTasks.map(fn) → Promise.all → 全部并发 → collector.waitAll → Reduce

v4: subTasks.map(fn) → ConcurrencyController.acquire()
     │                    ├─ 获取共享洞察(partialReduce)
     │                    ├─ Worker执行
     │                    ├─ collector.collect → onPartialResult → publishWorkerResult
     │                    └─ ConcurrencyController.release()
     └─ collector.waitAll → Reduce（上下文已预构建）

v5: + batchInjectContext 统一格式化
     + InsightEventBus 广播关键发现
     Map阶段: batchInjectContext(task.prompt, {compact}) → 注入Worker
     Reduce阶段: batchInjectContext(query, {detailed}) → 注入主Pi
     Worker完成 → publishWorkerResult → eventBus.broadcast → 其他Worker被动收到通知
```

## 测试结果

- **全量测试**: 887 tests / 36 files 全部通过
- **新增测试**: v4: 6项 | v5: 8项（InsightEventBus x5 + batchInjectContext x3）

## 收益量化

| 指标 | v3 | v4 | v5 |
|------|----|----|-----|
| 并发控制 | 无 | 信号量限流 | 同v4 |
| Reduce 方式 | 等全部 | 完成即注入 | 同v4 + 统一格式化 |
| 跨核知识传递 | Reduce可见 | Map实时共享 | Map实时共享 + 事件广播 |
| 上下文拼接 | 手动碎片 | 手动碎片 | batchInjectContext统一 |
| 可观测性 | 仅elapsed | +concurrencyStats | +eventBus统计 |
