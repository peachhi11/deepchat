# Stateful Agent Runtime / Harness Redesign 规格

## 概述

本规格定义 DeepChat 下一代 agent runtime 的重构方向：在保留现有 execution engine 的前提下，引入
`State Plane` 与 `Memory Plane` 作为一等公民，把系统从“能执行的聊天 runtime”提升为“可可靠执行长任务的 stateful agent runtime”。

本次 redesign 的目标不是为了新增一个抽象上的 harness，而是为了让 DeepChat 在真实任务执行中具备以下系统能力：

1. `Reliable`: 长任务、中断、权限等待、上下文压缩后仍能稳定继续。
2. `Accurate`: 完成态由结构化 task / acceptance / verification 决定，而不是由模型一句话宣布。
3. `Rollbackable`: 在关键节点可 checkpoint、可 handoff、可 resume / rollback / branch。
4. `Observable`: 用户和系统都能知道当前 run 在做什么、卡在哪里、依据是什么。

本规格的总体定义为：

```text
DeepChat Harness 2.0
  = Execution Plane
  × State Plane
  × Memory Plane
  + Observability / Eval Plane
  + Constraint / Recovery Plane
```

其中：

- `Execution Plane` 主要复用现有 `agentRuntimePresenter`、`ToolPresenter`、provider stream/tool loop。
- `State Plane` 是本次 redesign 的第一优先级。
- `Memory Plane` 是本次 redesign 的第二优先级。
- `Observability / Eval Plane` 和 `Constraint / Recovery Plane` 建立在前两者之上。

## 背景

DeepChat 当前公开和落地的 runtime 主链路已经完成了 legacy `AgentPresenter` retirement，现状是：

```text
Renderer
  -> agentSessionPresenter
  -> agentRuntimePresenter
  -> llmProviderPresenter / toolPresenter
  -> sqlitePresenter
```

当前 execution 侧已经具备较强能力：

1. `agentSessionPresenter` 负责 session lifecycle 与 IPC。
2. `agentRuntimePresenter` 独占聊天 runtime。
3. `process.ts` 已承担 stream loop。
4. `dispatch.ts` 已承担 tool dispatch、permission / question interaction。
5. `contextBuilder.ts` 已承担上下文构建与 compaction 相关逻辑。
6. `messageStore.ts` 与 `sessionStore.ts` 已承担消息与部分 session state 持久化。

但当前运行中的真实状态仍然分散在多个位置：

1. `runtimeState: Map<string, DeepChatSessionState>`
2. assistant message blocks 中的 `tool_call` / `action`
3. `pendingInputStore`
4. `sessionCompactionStates`
5. `resumingMessages` / interaction locks / abort controllers
6. message metadata / summary state / trace count

这意味着：

1. 聊天 transcript 仍然在事实层面承担了过多“控制平面”职责。
2. permission / pause / compaction / retry / completion 等控制状态缺少统一 source of truth。
3. 当前可恢复性和可评估性更多依赖“猜 message history”，而不是读取结构化 run state。
4. 后续要做 eval、constraint、recovery 时，缺少稳定内核可以依赖。

## 产品目标

### G1. 让任务执行拥有显式 `Run` 真相

系统必须能回答：

1. 当前有没有 active run
2. 当前 run 处于什么 `status`
3. 当前 run 处于什么 `stage`
4. 当前 task / step 是什么
5. 为什么在等待
6. 是否可以安全继续 / 回退 / 分叉

### G2. 让记忆从 transcript replay 升级为结构化 memory

系统必须能区分：

1. 这轮任务必须带上的 working set
2. 之前发生过什么关键决策与失败
3. 哪些是稳定事实，哪些会过期
4. 哪些结论有 evidence，哪些只是低置信度推断

### G3. 让 completion、recovery、eval 都读 state

后续的 verifier、grader、recovery action、quality gate 不应直接猜 transcript，而应优先读取：

1. `Run`
2. `TaskNode`
3. `StepRecord`
4. `Checkpoint`
5. `MemoryRecord`
6. `TraceEvent`

### G4. 让状态在 UI 中有一致展示面

用户必须可以在不打断主聊天体验的情况下，快速获得 run-level 反馈，并在需要时展开查看完整状态。

## 用户故事

### US-1：我想知道当前到底在做什么

作为用户，我希望在聊天页中看到一个轻量但清晰的 run 摘要，知道系统当前的状态、任务进度和阻塞原因。

### US-2：我想知道系统为什么停住了

作为用户，我希望当 run 进入 `waiting_permission`、`waiting_external`、`recovering` 或 `failed` 时，界面能明确告诉我阻塞点，而不是只在消息流里埋一个 block。

### US-3：我想让长任务可以继续，而不是重新猜上下文

作为用户，我希望权限批准、上下文压缩、重启、切换窗口、临时中止后，系统能依据 checkpoint 与 handoff 继续，而不是重新从 transcript 猜测现场。

### US-4：我想让“完成”更可信

作为用户，我希望 completed 代表 task graph 与 acceptance criteria 已满足，必要时已有 verify，而不是模型单方面说“done”。

### US-5：我想有一个统一地方看 run 细节

作为用户，我希望右侧 panel 中有专门的 `Run` tab，用来查看 goal、task list、checkpoint、recent trace 和 recovery action。

### US-6：我想在任务完成后有一个简洁收尾提示

作为用户，我希望 run 完成后，顶部胶囊条收起成一个轻量 `✓`，点击后打开 `Run` panel 查看结果，并在我看过后自动消失。

## 核心原则

### P1. Conversation is narrative, not control truth

聊天记录继续保留，但其职责是叙事、展示与导出，而不是控制系统运行的最终真相。

`RunStateStore` 必须成为 run-level source of truth。现有 `runtimeState`、message blocks、pending queue 只应承担热缓存或叙事层职责。

### P2. State-first before eval-first

在没有统一 `Run`、`Task`、`Step`、`Checkpoint`、`MemoryRecord` 之前，不先做完整 eval harness，也不先堆复杂 observability dashboard。

### P3. Memory is structured, scoped, and evidence-backed

memory 不是“把 transcript 全量再塞回 prompt”。memory 必须有 scope、provenance、confidence、freshness、supersede 关系。

### P4. Every meaningful step should commit state

执行循环必须从“连续聊天”升级为“bounded step execution”。每一步执行后都必须先 commit state，再决定是否继续。

### P5. Reuse the current execution engine

本次 redesign 不推翻 `agentRuntimePresenter`、`ToolPresenter`、provider runtime，而是在其之上增加 stateful kernel。

### P6. UI should surface state without bloating chat

状态 UI 不应变成更复杂的聊天框。轻量状态看顶部，完整状态看 `Run` tab。

## 术语

### `Run`

一次明确的任务执行上下文，绑定在某个 session 下，拥有 goal、status、stage、task graph、checkpoint、memory、trace。

### `TaskNode`

run 内的一项可跟踪任务，可拥有 acceptance criteria、dependsOn、owner、status。

### `StepRecord`

一次受控执行步骤的记录，代表“读取状态 -> 执行动作 -> 归档结果”的最小闭环。

### `Checkpoint`

在恢复、回退、handoff 时可以直接读取的结构化快照。

### `Handoff`

在 context reset、compaction、pause、resume 等场景中，用于跨上下文交接的结构化摘要。

### `Working Memory`

当前 step 必须携带的最小上下文集合。

## 范围

### In

本 initiative 总体包含以下内容：

1. `Harness Kernel`
   - `RunStateManager`
   - `MemoryManager`
   - `CheckpointManager`
2. `Run` / `TaskNode` / `StepRecord` / `Checkpoint` / `ArtifactRef` 一等公民建模与持久化
3. 基础 `MemoryRecord` 体系与 state-aware retrieval
4. 基础 `TraceEvent` 体系
5. `Run Ticker` 顶部胶囊条
6. 右侧 sidepanel 的 `Run / Workspace / Browser` 三 tab 布局
7. 基础 recovery action 与 checkpoint-driven resume

### First Implementation Wave

第一波实现必须优先交付：

1. `State Kernel`
2. `Checkpoint + Handoff`
3. 最小可用 `Memory Fabric`
   - 优先 `working` / `episodic` / `evidence`
4. 最小 `TraceEvent`
5. `Run Ticker`
6. 右侧 `Run` tab

### Out

以下内容不在首轮实现范围：

1. 全量 multi-agent tree orchestration redesign
2. 通用知识库产品化 UI
3. 独立的复杂 eval dashboard
4. 完整自动 policy engine
5. 全局 browser / workspace 视觉重做
6. 把所有已有 message block / tool card 全部迁移成 run UI

## 功能需求

### A. 架构分层

必须建立以下分层关系：

```text
Intent / Conversation Layer
  -> Harness Kernel
     -> State Manager
     -> Memory Manager
     -> Checkpoint Manager
     -> Policy Manager (later)
  -> Execution Engine
     -> agentRuntimePresenter
     -> process.ts
     -> dispatch.ts
     -> ToolPresenter
  -> Commit Log / Trace
  -> Observability / Eval (later)
  -> Constraint / Recovery (later)
```

要求：

1. `agentRuntimePresenter` 仍负责执行。
2. `SessionPresenter` 继续作为 legacy compatibility layer。
3. `Harness Kernel` 不替代 execution engine，而是包住 execution engine。

### B. `Run` 必须成为一等公民

系统必须支持：

1. 一个 session 拥有多个历史 run。
2. 一个 session 同时最多只有一个 active run。
3. 一个 run 具有明确的 `status` 与 `stage`。
4. 一个 run 可关联当前 task、当前 step、active checkpoint。
5. retry / branch / fork 允许产生新的 run lineage。

建议状态集：

```ts
type RunStatus =
  | 'draft'
  | 'planning'
  | 'ready'
  | 'executing'
  | 'waiting_permission'
  | 'waiting_external'
  | 'evaluating'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'aborted'
```

建议阶段集：

```ts
type RunStage = 'intent' | 'plan' | 'task' | 'verify' | 'handoff'
```

### C. 状态必须分为 durable / derived / ephemeral

#### Durable state

必须落盘：

1. `Run`
2. `TaskNode`
3. `StepRecord`
4. `Checkpoint`
5. `ArtifactRef`
6. `MemoryRecord`
7. `TraceEvent`
8. policy / eval 结果

#### Derived state

可以重算但建议缓存：

1. 当前 active task
2. progress %
3. recent failure pattern
4. risk level
5. suggested recovery action

#### Ephemeral state

只服务当前 loop：

1. token streaming buffer
2. in-flight tool handle
3. temporary UI animation state
4. abort controller / lock handles

要求：

1. 现有 `runtimeState` 必须降级为 hot cache。
2. run-level source of truth 必须来自持久化 state store。

### D. 执行循环必须变成 step-bounded loop

目标执行循环：

```text
resolve run state
  -> retrieve working memory
  -> build bounded step prompt
  -> execute one step
  -> normalize outputs
  -> commit state
  -> write memory / checkpoint / trace
  -> verify if needed
  -> next step or recover
```

要求：

1. 每次 step 执行后必须先 commit state。
2. completion 不能只由模型文本决定。
3. tool result、permission decision、question response 都必须映射到 `StepRecord`。
4. pause / resume / retry / continue 必须体现为 run 状态迁移。

### E. 建立 `Memory Fabric`

memory scope 至少支持：

1. `working`
2. `episodic`
3. `semantic`
4. `procedural`
5. `evidence`

每条 `MemoryRecord` 至少包含：

1. `scope`
2. `kind`
3. `summary`
4. `evidenceRefs`
5. `confidence`
6. `freshness`
7. `supersedes`
8. run / session / task 关联

要求：

1. 没有 evidence 的稳定事实不能直接进入高置信 `semantic` memory。
2. 低置信度结论优先进入 `episodic`。
3. memory write 必须有节流规则，只在高信号时刻发生。
4. retrieval 必须是 state-aware，而不是纯 embedding search。

### F. Checkpoint 与 handoff 必须结构化

系统至少要在以下时机建立 checkpoint：

1. task 切换前后
2. risky tool batch 之前
3. permission wait 之前
4. external wait 之前
5. compaction / context reset 之前
6. run completed / failed 之前

每个 checkpoint 必须可用于：

1. `Resume`
2. `Rollback`
3. `Branch`
4. `Reset + Handoff`

### G. 建立最小 observability baseline

每个 step 至少应产生结构化 trace：

1. `state_transition`
2. `tool_call`
3. `tool_result`
4. `memory_write`
5. `checkpoint`
6. `eval`

后续指标至少要能支持：

1. `resume_success_rate`
2. `false_done_rate`
3. `repeated_tool_call_rate`
4. `blocked_by_permission_time`
5. `checkpoint_coverage`
6. `task_reopen_rate`
7. `memory_hit_rate`

### H. Recovery 动作必须固定化

系统至少需要支持以下 recovery 动作：

1. `Resume`
2. `Rollback`
3. `Branch`
4. `Reset + Handoff`
5. `Safe Mode`

要求：

1. recovery 建议必须基于结构化 state 与 trace。
2. `Run` UI 中必须能展示当前推荐 recovery action。

### I. UI 展示面

#### I1. 顶部 `Run Ticker`

聊天页顶部必须有一个单行毛玻璃胶囊条：

1. 位置：`ChatTopBar` 下方，页面居中悬浮。
2. 形态：窄宽单行，不占用主聊天布局。
3. 作用：只显示 run-level 摘要，不显示细节。
4. 点击：打开右侧 `Run` tab。

显示内容：

1. 左侧固定状态
2. 中间单行摘要
3. 右侧轻量展开 affordance

正常执行示意：

```text
[ ● executing ]  Design retrieval policy · Task 2/5 · cp_007 · no blocker  [>]
```

完成态示意：

```text
[ ✓ ]
```

完成态要求：

1. run `completed` 后，胶囊条收起为轻量 `✓`。
2. 点击 `✓` 后打开右侧 `Run` tab。
3. 用户查看后该 `✓` 消失。

#### I2. 右侧 sidepanel 必须拥有独立 `Run` tab

sidepanel 必须调整为三个一级 tab：

1. `Run`
2. `Workspace`
3. `Browser`

不能把 run state 混入 `Workspace` 的 artifacts/files/git 导航中。

`Run` tab 至少展示：

1. run goal
2. status / stage
3. current task
4. task list
5. current checkpoint
6. blocker
7. recent events
8. recovery actions

示意：

```text
+-------------------------------- Right Sidepanel -------------------------------+
| Run | Workspace | Browser                                                     |
+--------------------------------------------------------------------------------+
| Goal: Make task execution reliable, accurate, rollbackable, observable        |
| Status: executing      Stage: task      Task: 2 / 5                           |
| Current task: Design retrieval policy                                         |
| Checkpoint: cp_007                                                            |
| Blocker: none                                                                 |
|                                                                               |
| Tasks                                                                         |
| [x] Define run model                                                          |
| [~] Design retrieval policy                                                   |
| [ ] Add checkpoint rules                                                      |
| [ ] Add recovery actions                                                      |
|                                                                               |
| Recovery                                                                      |
| [Resume] [Rollback] [Branch] [Reset] [Safe Mode]                              |
+--------------------------------------------------------------------------------+
```

#### I3. 外部 floating surface

桌面侧 floating widget 后续可以接入 run summary，但首轮仅要求不与 `Run Ticker` / `Run` tab 的信息结构冲突。

### J. 兼容与迁移

必须保证：

1. 现有 session / message persistence 继续可用。
2. 现有 `ToolPresenter` / provider runtime 不被推翻。
3. 现有 conversation export / history search / spotlight 不被破坏。
4. 旧 coarse session status 仍可继续为列表与轻量 UI 提供兼容字段。
5. 新 schema 采用 additive migration，不破坏已有用户数据。

## 验收标准

### State Kernel

- [ ] regular session 触发执行后，系统能创建并持久化 active `Run`
- [ ] run 拥有明确的 `status`、`stage`、`currentTaskId`、`activeCheckpointId`
- [ ] permission wait / external wait / abort / failure 都会变成明确 run 状态迁移
- [ ] `runtimeState` 不再承担 run-level source of truth

### Completion / Recovery

- [ ] completion 需要满足 task progress 与 acceptance / verify 条件，不能只靠模型文本
- [ ] 上下文压缩、pause、重启后可依据 checkpoint + handoff 恢复
- [ ] 系统能提供明确 recovery action，而不是只输出错误消息

### Memory

- [ ] working set 构建来自 run state + checkpoint + scoped memory，而不是 transcript 全量回灌
- [ ] 关键决策、失败、用户偏好、验证结果能进入结构化 memory
- [ ] memory record 可携带 evidence、confidence、freshness、supersedes

### UI

- [ ] 聊天页能显示单行 `Run Ticker`
- [ ] `Run Ticker` 点击后打开右侧 `Run` tab
- [ ] `Run Ticker` 在 blocked / waiting / failed 时固定显示高优先级状态
- [ ] run 完成后，`Run Ticker` 收起成 `✓`
- [ ] 点击 `✓` 打开 `Run` tab 后，完成态提示消失
- [ ] sidepanel 存在独立 `Run / Workspace / Browser` 三 tab

### Observability

- [ ] 每个关键 step 至少产出一条结构化 trace
- [ ] run timeline 能还原主要状态迁移、tool 结果与 checkpoint

## 非目标

1. 本规格不追求一次性重写整个 agent runtime。
2. 本规格不把所有 UI 都替换成 run-first 视图。
3. 本规格不在首轮实现全量 eval dashboard。
4. 本规格不先做复杂多层 subagent tree runtime。
5. 本规格不以 transcript summarization 代替 structured handoff。

## 约束

1. 遵循当前 Presenter + SQLite + Vue 3 架构。
2. 用户可见文案必须走 i18n。
3. 状态 UI 必须符合当前玻璃感 / 轻悬浮设计语言，不引入全新设计体系。
4. `Run Ticker` 必须保持单行、轻量，不膨胀成新的顶部控制台。
5. 首轮实现优先 regular DeepChat session，不把 ACP runtime 作为主路径。

## 开放问题

无。
