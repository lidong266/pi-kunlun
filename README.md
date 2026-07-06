# 昆仑OS (Pi-Kunlun) — AI 认知操作系统

> **以大成智慧学为运行、以 Pi Agent 为内核、以矛盾论/实践论/论持久战/OCGS为核心算法、**
> **以三进制(+1/0/-1)为数学底座、以七层认知流为架构的 AI 认知操作系统**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-green)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-orange)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-90%2F90%20passing-brightgreen)](.)

---

## 什么是昆仑OS？

昆仑OS 不是一个后端平台、不是聊天机器人、不是知识库。它是一个 **AI 认知操作系统**——让 AI 与人类在同一个系统中共同感知、思考、表达、记忆、治理、进化和行动。

### 定位

```
Linux 内核     →  Android / Windows / HarmonyOS  用户操作系统
Pi Agent       →  昆仑OS                          认知操作系统
   ↑                        ↑
   内核层                   用户层 OS
```

**关键原则：昆仑OS 调度 Pi，不是 Pi 调度昆仑OS。**

从 HarmonyOS 借鉴调度器设计思想（每核独立队列/SchedOps虚函数表多态/SMP IPI/跨核通信），但所有子系统以 AI 认知操作系统的需求为出发点，而非硬件操作系统的子系统分类。

---

## 架构总览

```
 ┌──────────────────────────────────────────────────────────┐
 │  用户界面层（TUI / CLI / Web / 微信 / API）               │
 ├──────────────────────────────────────────────────────────┤
 │  认知服务层 — 七层认知流                                  │
 │  感知 → 思考 → 表达 → 记忆 → 治理 → 进化 → 行动          │
 ├──────────────────────────────────────────────────────────┤
 │  算法核心 — 四大算法引擎                                   │
 │  矛盾论 · 实践论 · 论持久战 · OCGS                        │
 │  三进制数学底座 (+1/0/-1)                                 │
 ├──────────────────────────────────────────────────────────┤
 │  内核抽象层 CogKAL                                        │
 │  ├── 多认知核心调度器（三策略/IPI/亲和性/GC）              │
 │  ├── Token/注意力预算管理                                  │
 │  ├── 认知能力注册表                                       │
 │  ├── 认知信任与价值对齐                                    │
 │  └── 认知执行引擎                                         │
 ├──────────────────────────────────────────────────────────┤
 │  调度以下认知内核资源                                      │
 ├──────────────┬──────────────┬────────────────────────────┤
 │  Pi Agent    │  LLM 实例    │  工具/记忆/知识库/人类       │
 │  (认知微内核)  │  (算力内核)   │  (能力提供者)              │
 └──────────────┴──────────────┴────────────────────────────┘
```

### 三层架构（从 HarmonyOS 借鉴）

| HarmonyOS 层 | 昆仑OS 层 | 说明 |
|-------------|----------|------|
| LiteOS-A 微内核 | **CogKAL 多认知核心调度器** | 控制"认知任务在哪里执行" |
| 分布式软总线 | **认知事件总线** | 控制"哪些认知节点可以协作" |
| AI Engine | **四大算法 Plugin** | 控制"什么认知算法来处理" |

---

## 设计文档（24章，1576行）

完整设计方案位于 [`docs/architecture/昆仑OS-设计方案.md`](docs/architecture/昆仑OS-设计方案.md)：

| 章节 | 内容 |
|:----:|------|
| 1-3 | 愿景、架构总览、七层认知流 |
| 4-5 | 四大算法引擎、三进制数学底座 |
| 6 | CogKAL 认知内核抽象层 |
| **7** | **多认知核心调度器**（三策略/亲和性/IPI/GC/多实例启动） |
| **8** | **认知事件总线**（节点发现/CogLedger/双通道） |
| **9** | **四大算法 Plugin 注册机制**（参考 AI Engine IPlugin） |
| 10-12 | 战略分期、技术选型、与现有架构的关系 |
| 13 | HarmonyOS 借鉴清单 |
| 14 | TypeScript 架构框架 |
| **15** | **认知能力注册**（CogCapabilityRegistry） |
| **16** | **Token/注意力预算**（CogMemoryPool） |
| **17** | **认知信任与价值对齐**（CogTrust） |
| 18 | 认知执行引擎 |
| **19** | **七层流数据管道**（CogPipeline） |
| **20** | **认知进程模型**（萌芽→探索→结晶→表达→归档） |
| **21** | **人类节点异步模型** |
| **22** | **大成智慧学可操作化**（从定性到定量综合集成） |
| 23-24 | 引导顺序、行动清单 |

---

## 关键设计

### 三策略调度器

```typescript
// 不是时间片调度，而是矛盾优先级调度
function topCogTaskGet(rq: CogRunqueue): CogTaskCB | null {
  // ① 共识截止时间（deadline 最近优先，类比 EDF）
  const consensusTask = consensusQueueTopTaskGet(rq.consensusQueue)
  if (consensusTask) return consensusTask
  // ② 矛盾优先级（矛盾尖锐优先，类比 HPF 32级位图）
  const contradictionTask = contradictionQueueTopTaskGet(rq.contradictionQueue)
  if (contradictionTask) return contradictionTask
  // ③ 螺旋迭代（收敛度最差优先，昆仑新增）
  const spiralTask = spiralQueueTopTaskGet(rq.spiralQueue)
  if (spiralTask) return spiralTask
  return rq.idleTask  // 空闲：自我进化/记忆归纳
}
```

### 认知亲和性（类比 CPU Affinity）

```typescript
interface KernelAffinity {
  preferredKernel: 'pi-agent' | 'llm' | 'tool' | 'human'
  currentInstance: string
  allowedInstances: string[]
}
```

### 跨 Pi 实例 IPI（类比 SMP 核间中断）

```typescript
enum CogIPIType { WAKEUP, SCHEDULE, HALT, FUNC_CALL }
function cogMpSchedule(target: string[]): void {
  // 通过认知事件总线向目标实例发送 IPI
}
```

---

## 包结构

### V2 核心包（8包 Monorepo）

```
packages/
├── kunlun-ternary         L0  三元类型系统（Trit/Tryte/K3）
├── kunlun-eventbus        L2  三元事件总线
├── kunlun-presence        L4  认知在场
├── kunlun-contradiction   L5  矛盾引擎（8分析器+辩证推理）
├── kunlun-ocgs            L6  OCGS自适应层（生态感知/涌现检测）
├── kunlun-pw              L7  论持久战（三阶段评估）
├── kunlun-spiral          L8  实践螺旋
├── kunlun-subsystems      L3  认知子系统（谛听/太一/天工/琅嬛/归藏/玄关/镇岳/镇商）
```

### 扩展 & Fork

```
extension/                 Pi 扩展入口（昆仑OS engine 注册）
  ├── index.ts             全链路管线（矛盾→策略→螺旋→生态→记忆）
  ├── persistent-memory.ts SQLite 持久化记忆
  ├── conflict-detector.ts 冲突检测器
  └── dragon-gate.ts       龙门补录

fork/packages/agent        Pi Agent Fork（注入三元分析+工具路由）
  ├── agent-loop.ts        925行注入三元分析
  ├── kunlun-bridge.ts     三层适配器（分析/决策/记忆）
  └── harness/             AI 安全带框架
```

---

## 包依赖层级

```
@kunlun/ternary               (L0)  三元类型系统
    ↓
@kunlun/eventbus              (L2)  三元事件总线
    ↓
@kunlun/presence              (L4)  认知在场
@kunlun/contradiction         (L5)  矛盾引擎
    ↓
@kunlun/subsystems            (L3)  认知子系统
    ↑           ↑              ↑
@kunlun/ocgs   @kunlun/spiral @kunlun/pw
               (L6)           (L8)   (L7)
```

---

## 三进制类型系统

```typescript
type Trit = 1 | 0 | -1;
// +1 = 支持 / 强化
//  0 = 中立 / 待定
// -1 = 反对 / 否定

// K3 三值逻辑
TernaryLogic.AND(1, 0);    // → 0
TernaryLogic.OR(-1, 0);    // → 0
TernaryLogic.NOT(1);       // → -1
TernaryLogic.IMPLIES(0, -1); // → 0
```

---

## 测试

```bash
# 全部集成测试（90个，8个套件）
pnpm exec vitest run integration-tests --config integration-tests/vitest.config.ts

# 单个包测试
pnpm --filter @kunlun/ternary test

# 测试覆盖
pnpm --filter @kunlun/ternary test --coverage
```

**90/90 全部通过** ✅

---

## 快速开始

```bash
# 克隆
git clone https://github.com/lidong266/pi-kunlun.git
cd pi-kunlun

# 安装
pnpm install

# 构建
pnpm run build

# 测试
pnpm exec vitest run integration-tests
```

---

## 许可证

[MIT](LICENSE) © 2025-2026 Pi-Kunlun Contributors

---

> *"从定性到定量综合集成"* — 钱学森 大成智慧学
