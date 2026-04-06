# 当前状态审计

## 目的

本审计文档回答三个问题：

1. DeepChat 当前活跃 runtime 到底是谁在负责什么。
2. 当前系统已经有哪些可复用的执行能力。
3. 当前系统为什么已经到了必须引入 `State Plane` 与 `Memory Plane` 的阶段。

本文件只分析现状与缺口，不定义最终设计。最终设计见 [`state-kernel.md`](./state-kernel.md) 与 [`memory-fabric.md`](./memory-fabric.md)。

## 当前活跃架构

在 legacy `AgentPresenter` retirement 之后，当前活跃主链路已经明确为：

```text
Renderer
  -> agentSessionPresenter
  -> agentRuntimePresenter
  -> llmProviderPresenter / toolPresenter
  -> sqlitePresenter
```

对应职责边界：

| 模块 | 当前职责 | 是否继续复用 |
| --- | --- | --- |
| `agentSessionPresenter` | session lifecycle、IPC、fork / retry / delete / export 入口 | 是 |
| `agentRuntimePresenter` | runtime orchestration、执行入口、运行时缓存 | 是 |
| `process.ts` | stream loop | 是 |
| `dispatch.ts` | tool dispatch、permission / question 交互 | 是 |
| `contextBuilder.ts` | 历史裁剪、resume context、token budget | 是 |
| `messageStore.ts` | 新消息持久化、pending message 恢复 | 是 |
| `sessionStore.ts` | provider/model/permission/summary persistence | 是 |
| `ToolPresenter` | MCP / agent tool routing | 是 |
| `SessionPresenter` | legacy conversation/export/search 兼容层 | 是，但不作为新控制内核 |

## 当前 execution plane 已经足够强的部分

如果只看“能不能跑任务”，DeepChat 现在其实已经有比较完整的执行面：

### 1. Session lifecycle 已经独立

`agentSessionPresenter` 已经把 session CRUD、激活、删除、fork、会话切换从运行时执行里剥离出来。

这意味着后续引入 `Run` 时，不需要再重做 session 生命周期。

### 2. Runtime execution 已经单点收敛

`agentRuntimePresenter` 已经成为 DeepChat runtime 的唯一 owner，这对 state-first redesign 是非常重要的前提。

如果 runtime 入口仍然分散在多个 presenter，后续就很难在一个地方包住 execution plane。

### 3. Tool 路由已经集中

`ToolPresenter` 已经统一承担 agent tools / MCP tools 路由，execution plane 不缺“工具可用性”。

后续需要做的是“工具调用如何影响 run state”，不是“工具怎么再重构一遍”。

### 4. Permission / interaction 已经有基础流

当前系统已经支持：

1. permission request block
2. question request block
3. `respondToolInteraction`
4. resume after decision

这说明恢复能力的雏形已存在，只是还没有被提升为 run-level recovery model。

### 5. Compaction 与 summary 已存在

当前已有：

1. `sessionCompactionStates`
2. `CompactionService`
3. session summary state

这说明系统已经承认“上下文会溢出、需要压缩”，但目前压缩更多是 message/history 维度，还不是 run/checkpoint/handoff 维度。

## 当前状态是如何分散的

这是本 redesign 的核心问题。

### A. 粗粒度 session 状态

当前 `DeepChatSessionState` 只有：

```ts
type SessionStatus = 'idle' | 'generating' | 'error'
```

它能告诉我们：

1. 大概是否在跑
2. provider / model / permissionMode

但不能告诉我们：

1. run 是在 plan 还是 verify
2. 当前 task 是什么
3. 为什么在等待
4. 有没有 checkpoint
5. 失败后建议怎么恢复

### B. message block 承担了过多控制语义

assistant message blocks 当前既用于展示，又承担了控制语义：

1. `tool_call`
2. `tool_call_permission`
3. `question_request`
4. `rate_limit`

问题在于：

1. 这些 block 很适合渲染，不适合作为系统真相。
2. 它们是 narrative layer，而不是 control layer。
3. 一旦需要跨 compaction、跨 restart、跨 recovery 读状态，就不得不“猜 block”。

### C. interaction locks / pending queues / abort controllers 都是局部 runtime state

当前 runtime 里存在很多必要但局部的运行态：

1. `interactionLocks`
2. `resumingMessages`
3. `drainingPendingQueues`
4. `abortControllers`
5. `activeGenerations`

这些状态对执行本身必要，但它们天然属于 `ephemeral state`。如果没有 durable state 作支撑，系统重启或 context reset 时就失真。

### D. summary / compaction 不是 run-level checkpoint

现在的 summary state 主要服务于：

1. token budget
2. message context shrink

但它不是：

1. 任务执行 checkpoint
2. recovery handoff
3. verifier input
4. run outcome record

这就是为什么当前 compaction 还不足以解决长任务可靠性问题。

## 当前系统缺的不是“更多能力”，而是“更高阶的真相层”

### 缺口 1：没有 run-level source of truth

系统当前能回答“这个 session 正在 generating 吗”，但回答不了“这个 run 正在执行哪个 task、为什么卡住、是否能安全恢复”。

### 缺口 2：没有结构化 task model

系统当前可执行，但对“任务拆分、任务完成、任务 reopen、任务阻塞”缺少 durable 表达。

这直接导致：

1. false done 难以识别
2. acceptance criteria 难以落地
3. verifier 没有稳定输入

### 缺口 3：没有结构化 memory

当前系统的“记住什么”主要还是依赖：

1. message history
2. summary text
3. 少量 metadata

这不足以应对长任务中最关键的问题：

1. 哪些事实稳定
2. 哪些失败要记住
3. 哪些偏好应该跨 step 带着
4. 哪些结论只是低置信度推断

### 缺口 4：恢复还不是一等能力

当前系统有 resume 的局部链路，但没有统一 recovery model。缺少：

1. 标准 recovery action
2. checkpoint lineage
3. rollback / branch / reset + handoff 的统一入口

### 缺口 5：观测与评估没有稳定支点

没有结构化 `Run / Task / Step / Checkpoint / Memory` 时：

1. trace 很难完整
2. metrics 很难稳定
3. eval 很容易退化成 transcript 字符串匹配

## 现有系统里哪些东西值得直接复用

### 1. `messageStore` 作为 narrative 与 artifact 来源

虽然 message 不应该继续做控制真相，但它仍然是：

1. UI narrative
2. artifact 抽取源
3. trace button / export / search 的基础数据层

### 2. `sessionStore` 作为 coarse session persistence

session store 仍然适合继续保存：

1. providerId
2. modelId
3. permissionMode
4. summary state

但不应继续承担完整 run 真相。

### 3. `CompactionService` 作为 handoff / checkpoint 的基础能力

compaction 服务可演进为：

1. `before_compaction` checkpoint producer
2. handoff builder 的调用点
3. compacted resume 的恢复入口

### 4. `internalSessionEvents` 作为 run snapshot 分发通路

当前已有内部 session 更新广播，可以继续用于：

1. pushing `RunSnapshot`
2. sidepanel `Run` tab refresh
3. ticker state sync

### 5. `ChatToolInteractionOverlay` 作为 waiting UI 基础

overlay 已经很好地处理了“需要用户立刻响应”的场景。后续应将其与 run blocker model 对齐，而不是替换掉。

## 为什么现在适合先做 state-first

从工程时机看，现在做 state-first 有三个优势：

### 1. execution plane 已经足够收敛

如果 runtime ownership 还在 legacy 迁移中，现在切 state-first 会非常危险。但目前主链路已经稳定，适合加内核层。

### 2. sidepanel 与 floating glass language 已经成型

这意味着状态 UI 不需要从零发明，可直接落在：

1. 顶部 `Run Ticker`
2. 右侧 `Run` tab
3. 桌面浮层的后续对接

### 3. trace / permission / compaction 都已经有切入点

不是从零搭系统，而是把已有局部能力提升成一致的 state model。

## 本审计的结论

当前 DeepChat 的主要短板不是：

1. 模型不够强
2. tool routing 不够强
3. execution loop 不够强

而是：

1. 没有统一的 `Run` 真相层
2. 没有结构化 task 与 checkpoint
3. 没有 state-aware memory
4. 没有基于 state 的 recovery、observability 与 eval

因此，后续实施必须遵守以下顺序：

1. 先建 `State Kernel`
2. 再建 `Memory Fabric`
3. 再接 `Observability`
4. 再扩展 `Recovery / Eval / Policy`

这也是整个专题的基本立场。
