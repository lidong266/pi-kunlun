# 昆仑OS (KunlunOS) — AI 认知操作系统

> **以大成智慧学为运行、以 Pi Agent 为微内核、以矛盾论/实践论/论持久战/OCGS为核心算法、**
> **以三进制(+1/0/-1)为数学底座、以七层认知流为架构的 AI 认知操作系统**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-green)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-orange)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-694%20passing-brightgreen)](.)
[![Build](https://img.shields.io/badge/build-11%20packages-blue)](.)

> **⚠️ 当前成熟度：种子期 → 成长期过渡**（诚实标注，见[架构文档约束4](./昆仑OS-大成智慧学架构设计文档.md)）。
> 十一桥路由(P0)、量智/性智双轴(P1)、龙门自进化(P2)、人以为主裁决(P3) 已接通，但**学科专家资格仍由规则卡(seed 33张 + 龙门草稿)驱动，非数据驱动的真正专家**；综合集成共识计算为骨架占位（双轴已注入立场）。落地清单见[项目落地文档](./昆仑OS-项目落地到安装运行步骤.md)。

---

## 当前成熟度（诚实标注）

按大成智慧学架构落地路线，系统分三阶段：

| 阶段 | 标志 | 当前状态 |
|------|------|---------|
| **种子期** | 33 张种子卡，专家靠 prompt/规则撑，多数桥是"空专家" | ✅ 已越过（P0/P1/P2/P3 已接） |
| **成长期** | 龙门持续补录、卡片丰富、双轴能真实判题 | 🟡 **当前所在**：龙门刚接通，卡片仍稀疏，双轴对抽象命题常判不出 |
| **成熟期** | 真·数据驱动专家，归藏卡片自繁衍，共识计算真实 | 🔴 未到 |

**已落地**（本轮）：多桥路由、量智×性智双轴、龙门缺桥补录并写归藏、人以为主裁决闭环。
**已知局限**：综合分析共识计算仍为骨架（参与者立场 T_UNKNOWN 占位，仅双轴带立场）；种子卡覆盖有限导致抽象命题判不出（由龙门补）；无人在线时共识仅标"待人工确认"不擅权。

---

## 快速开始

### 方式一：一键安装脚本（推荐）

```bash
# 直接下载并运行（自动检查 Node≥22 → 启用 pnpm → 克隆 → 安装 → 验证）
bash <(curl -fsSL https://raw.githubusercontent.com/lidong266/KunlunOS/main/install.sh)

# 或先克隆再在仓库内运行
git clone https://github.com/lidong266/KunlunOS.git
cd KunlunOS
bash install.sh                 # 也可指定目录: bash install.sh my-app
```

### 方式二：手动安装

```bash
git clone https://github.com/lidong266/KunlunOS.git
cd KunlunOS
pnpm install
pnpm test          # 694 tests (注意: 勿用 pnpm -r test, fork/agent vitest 版本冲突; 用 npx vitest run)
pnpm -r build      # 11 packages
```

### 运行离线认知 CLI（无需 LLM API）

```bash
npx tsx packages/kunlun-os-core/bin/kunlun.mjs boot
```

在 TTY 终端中运行 `boot` 会显示**鸿蒙6风格的彩色启动动画**（CogBoot 6 阶段引导序列）。
无需任何 API Key 即可体验昆仑OS 的核心认知能力：十一桥路由 → 矛盾分析 → 综合集成 → 天工渲染。

```bash
# 离线认知命令（无需 API Key）
npx tsx packages/kunlun-os-core/bin/kunlun.mjs analyze "性能和成本如何权衡"     # 大成智慧学认知管线
npx tsx packages/kunlun-os-core/bin/kunlun.mjs contradiction "追求性能" vs "保证成本"  # 矛盾分析引擎（8分析器）
npx tsx packages/kunlun-os-core/bin/kunlun.mjs bridge "如何设计微服务架构"      # 十一桥路由+知识卡片
npx tsx packages/kunlun-os-core/bin/kunlun.mjs bridges                          # 列出全部十一桥
npx tsx packages/kunlun-os-core/bin/kunlun.mjs boot                              # CogBoot 6阶段引导（含启动动画）
npx tsx packages/kunlun-os-core/bin/kunlun.mjs status                            # OS 运行状态
npx tsx packages/kunlun-os-core/bin/kunlun.mjs                                   # 无 API Key 时进入离线 REPL
```

> 启动动画默认开启；非 TTY（管道/脚本）环境自动降级为纯文本。可通过 `KunlunOSConfig.showBootAnim = false` 关闭。

### 运行 Demo（无需 LLM API）

```bash
npx tsx demo/contradiction-demo.ts
```

演示矛盾分析引擎的完整管线：输入真实矛盾场景 → 8 个分析器逐对分析 → 输出结构化结果（统一性/主导方面/质变临界/否定之否定/转化预测）。

### 运行 LLM 交互模式 CLI（需 API Key）

```bash
export KUNLUN_API_KEY=sk-xxx
export KUNLUN_MODEL_ID=gpt-4o
npx tsx packages/kunlun-os-core/bin/kunlun.mjs
```

---

## 什么是昆仑OS？

昆仑OS 是一个 **AI 认知操作系统**。它不是一个聊天机器人、不是一个后端平台、不是一个知识库。

### 定位

```
Linux 内核     →  Android / HarmonyOS    用户操作系统
Pi Agent       →  昆仑OS (KunlunOS)      认知操作系统
   ↑                    ↑
   微内核               认知调度层 OS
```

**昆仑OS 调度 Pi，不是 Pi 调度昆仑OS。**

### 核心能力

| 能力 | 描述 |
|------|------|
| 🧠 **大成智慧学认知管线** | 十一桥路由 → 知识卡片 → 矛盾分析 → 综合集成 → 天工渲染 |
| ⚡ **多微内核 MapReduce** | 1个主Pi + N个工作Pi，LLM智能拆解 + 并行执行 + 综合汇总 |
| 💾 **共享认知层** | Token预算共享 / LLM缓存 / 归藏记忆 / 分析缓存 |
| 🔧 **工具调用去重** | 多Pi并发相同工具调用 → 只执行1次 |
| 📡 **认知预取** | 主Pi分析后预注入上下文到子Pi，省去各自检索 |
| 🛡️ **四层风控** | 镇岳安全管线（预检→门控→升级→热力图） |
| 🎯 **三策略调度** | EDF(截止时间) > HPF(矛盾优先级) > Spiral(螺旋迭代) |

---

## 架构

```
┌──────────────────────────────────────────────────────────┐
│  昆仑OS 核心 (kunlun-os-core)                             │
│  KunlunOS + KunlunAgent + MultiKernelOrchestrator        │
│  ElevenBridges + CogBoot + CLI                           │
├──────────────────────────────────────────────────────────┤
│  共享认知层 (SharedCognitiveLayer)                        │
│  TokenManager / LLM缓存 / 归藏记忆 / 分析缓存             │
├──────────────────────────────────────────────────────────┤
│  八子系统 (kunlun-subsystems)                             │
│  谛听·太一·天工·琅嬛·归藏·镇岳·镇熵·玄关                  │
├──────────────────────────────────────────────────────────┤
│  四大算法引擎                                             │
│  矛盾论 · 实践论 · 论持久战 · OCGS                        │
│  三进制数学底座 (+1/0/-1)                                 │
├──────────────────────────────────────────────────────────┤
│  认知基础设施 (10包)                                       │
│  CogKAL调度器 / CogBus事件总线 / CogAlgo算法Plugin         │
│  CogCapability能力注册 / CogTrust信任 / CogMemory记忆      │
│  CogPipeline七层流 / CogProcess进程 / CogHuman人机          │
│  CogMetaSynthesis大成智慧学 / CogExecutor执行引擎          │
├──────────────────────────────────────────────────────────┤
│  Pi 微内核 (fork/packages/agent)                          │
│  Agent + AgentLoop + KunlunBridge + Proxy                 │
└──────────────────────────────────────────────────────────┘
```

---

## 使用示例

### 基础认知分析

```typescript
import { KunlunOS } from '@kunlun/os-core';

const os = new KunlunOS();
await os.start();

const analysis = await os.injectCognition(
  [{ role: 'user', content: '性能和成本如何权衡' }],
  'You are a helpful assistant.'
);

console.log(analysis.bridge?.name);   // 自然辩证法
console.log(analysis.contradictions); // [{ thesis: '追求性能', antithesis: '保证成本' }]
console.log(analysis.promptInjection);
// ─── 大成智慧学·认知分析（昆仑OS） ───
// 【🔬 自然辩证法桥】物质第一性·意识第二性
// 【知识卡片】AX-001 / SC-001 / TC-001
// 【矛盾感知】追求性能 ↔ 保证成本
// 【综合集成】均势待定 (0.33)
// 【天工渲染】? 待验证
```

### 多 Pi MapReduce 深度分析

```typescript
import { createOrchestrator, InMemorySessionRepo, NodeExecutionEnv } from '@kunlun/os-core';

const orch = await createOrchestrator({
  env: new NodeExecutionEnv({ cwd: '/tmp' }),
  session: await new InMemorySessionRepo().create(),
  models, model,  // 需要 LLM 后端
}, { workers: 3 });

// 一键深度分析: injectCognition → LLM智能拆解 → 多Pi并行 → 综合
const result = await orch.deepAnalyze('分析这个电商平台的增长策略');

// 查看共享层状态
console.log(orch.shared.getStats());
// { tokens: {...}, cache: {...}, memories: 3, analysisCache: 1 }

orch.stop();
```

---

## 包结构（22包）

| 包 | 层 | 描述 |
|------|------|------|
| `kunlun-ternary` | L0 | 三进制类型系统（Trit/Tryte/K3） |
| `kunlun-eventbus` | L2 | 三元事件总线 |
| `kunlun-presence` | L4 | 认知在场 |
| `kunlun-subsystems` | L3 | 八子系统（谛听/太一/天工/琅嬛/归藏/镇岳/镇熵/玄关） |
| `kunlun-contradiction` | L5 | 矛盾引擎（8分析器） |
| `kunlun-spiral` | L8 | 实践螺旋 |
| `kunlun-pw` | L7 | 持久战策略 |
| `kunlun-ocgs` | L6 | OCGS自适应层 |
| `kunlun-cogkal` | L6 | 认知内核调度器 |
| `kunlun-cogbus` | L6 | 认知事件总线 |
| `kunlun-cog-algo` | L6 | 算法Plugin注册 |
| `kunlun-cog-capability` | L6 | 认知能力注册 |
| `kunlun-cog-trust` | L6 | 信任管理 |
| `kunlun-cog-memory` | L6 | Token/记忆管理 |
| `kunlun-cog-pipeline` | L6 | 七层流管道 |
| `kunlun-cog-process` | L6 | 认知进程管理 |
| `kunlun-cog-human` | L6 | 人类节点通道 |
| `kunlun-cog-metasynthesis` | L6 | 大成智慧学综合集成 |
| `kunlun-cog-executor` | L6 | 认知执行引擎 |
| `kunlun-os-core` | OS | **OS核心** (KunlunOS/Agent/CLI/Bridge) |
| `fork/packages/agent` | 微内核 | **Pi微内核** (AgentLoop/Bridge/Proxy) |

---

## 设计文档

完整24章设计方案：[`docs/architecture/昆仑OS-设计方案.md`](docs/architecture/昆仑OS-设计方案.md)

实现率：**23/24 章 (95.8%)**

---

## 测试

```bash
pnpm test                    # 903 tests, 37 files, all passing
pnpm -r build                # 22 packages
```

---

## 版本

| 版本 | 日期 | 核心变更 |
|------|------|----------|
| v0.9 | 07-06 | 离线认知 CLI（矛盾/十一桥/大成智慧学，无需 LLM API）+ tsx 依赖 |
| v0.8 | 07-06 | 多微内核MapReduce + 共享认知层 + LLM智能拆解 |
| v0.7 | 07-06 | 大成智慧学·十一桥知识卡片 + injectCognition五阶段管线 |
| v0.6 | 07-06 | Pi微内核化，AgentHarness迁移到昆仑OS |
| v0.5 | 07-06 | 12个认知基础设施包 + OS核心 |
| v0.4 | 07-05 | 三进制 + 八子系统 + 设计文档 |

---

## 许可证

[MIT](LICENSE) © 2025-2026

---

> *"从定性到定量综合集成"* — 钱学森 大成智慧学
