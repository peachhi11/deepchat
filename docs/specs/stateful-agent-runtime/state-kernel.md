# State Kernel

## 目的

本文件单独定义 DeepChat stateful runtime 的控制内核，即：

1. 什么是 `Run`
2. 什么是 `Task`
3. 什么是 `Step`
4. 什么是 `Checkpoint`
5. 什么状态应该落盘，什么状态只是热缓存
6. execution plane 如何与 state kernel 对接

如果 [`spec.md`](./spec.md) 回答的是“为什么做”，本文件回答的是“系统真相到底长什么样”。

## 设计立场

### 1. `Run` 是新的控制单位

session 仍然是 UI / conversation / lifecycle 的宿主，但控制层不应该再停留在 session 粒度。

原因：

1. 一个 session 可以经历多个任务阶段和多个恢复分支。
2. retry / fork / branch 都天然更像 run lineage，而不是 session mutation。
3. `Run` 比 `session` 更适合作为 eval、checkpoint、memory、trace 的锚点。

### 2. `runtimeState` 不是最终真相

当前 `runtimeState` 仍然有价值，但它的职责应该收敛为：

1. 当前 loop 的热缓存
2. 当前 provider/model/permissionMode 的快速读取
3. coarse session status 的兼容输出

真正的 run truth 必须来自 `RunStateStore`。

### 3. 状态与叙事分层

必须明确区分：

1. `State`
   - 系统依据它来继续、恢复、评估、回退
2. `Narrative`
   - 用户看到的消息、tool cards、reply text

assistant message block 可以镜像 state，但不能替代 state。

## 核心实体

## 1. `HarnessRun`

`HarnessRun` 代表一次明确的任务执行。

建议定义：

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

type RunStage = 'intent' | 'plan' | 'task' | 'verify' | 'handoff'

type HarnessRun = {
  id: string
  sessionId: string
  parentRunId?: string | null
  originCheckpointId?: string | null
  title: string
  goal: string
  status: RunStatus
  stage: RunStage
  currentTaskId?: string | null
  currentStepId?: string | null
  activeCheckpointId?: string | null
  environmentId?: string | null
  triggerMessageId?: string | null
  startedAt?: number | null
  completedAt?: number | null
  createdAt: number
  updatedAt: number
}
```

### `Run` 的职责

它必须能回答：

1. 当前这个任务是什么
2. 当前卡在什么阶段
3. 当前激活的 task / step / checkpoint 是什么
4. 是正常执行、等待、恢复、评估还是失败
5. 这个 run 是从哪个 checkpoint branch 出来的

### `Run` 的生命周期

标准生命周期：

```text
draft
  -> planning
  -> ready
  -> executing
  -> waiting_permission / waiting_external
  -> recovering
  -> evaluating
  -> completed / failed / aborted
```

不是每个 run 都必须经过所有状态，但状态必须显式迁移。

## 2. `TaskNode`

`TaskNode` 代表 run 内的一项明确任务。

建议定义：

```ts
type RunTaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'failed' | 'skipped'

type TaskNode = {
  id: string
  runId: string
  title: string
  description?: string | null
  status: RunTaskStatus
  acceptanceCriteria: string[]
  dependsOn: string[]
  owner: 'agent' | 'human' | 'evaluator'
  orderIndex: number
  blockerReason?: string | null
  createdAt: number
  lastUpdatedAt: number
}
```

### `TaskNode` 的作用

1. 把“正在做什么”从模型自由文本里剥离出来。
2. 为 completion gate 提供结构化基础。
3. 让 reopen、partial completion、blocked、dependency 都有 durable 表达。

### 为什么 task 一定要持久化

否则：

1. completion 只能猜
2. recovery 无法精确回到某个任务
3. eval 无法判断产出是否满足 acceptance criteria

## 3. `StepRecord`

`StepRecord` 是 bounded step execution 的最小记录。

建议定义：

```ts
type StepRecord = {
  id: string
  runId: string
  taskId?: string | null
  actionType:
    | 'reason'
    | 'tool_call'
    | 'tool_result'
    | 'decision'
    | 'artifact_write'
    | 'checkpoint'
    | 'handoff'
    | 'verification'
  status: 'started' | 'completed' | 'failed' | 'aborted'
  summary: string
  inputRef?: string | null
  outputRef?: string | null
  payloadJson?: string | null
  startedAt: number
  endedAt?: number | null
}
```

### 为什么 step 是关键单位

execution plane 真正可靠的循环，不是“无限续聊”，而是：

1. resolve current truth
2. perform one bounded step
3. commit the result

没有 `StepRecord`，就没有：

1. 稳定 trace
2. 稳定 handoff
3. 稳定 eval input

## 4. `RunCheckpoint`

`RunCheckpoint` 代表某个可恢复边界的结构化快照。

建议定义：

```ts
type RunCheckpoint = {
  id: string
  runId: string
  stepId?: string | null
  kind:
    | 'task_boundary'
    | 'before_risky_tool'
    | 'before_wait'
    | 'before_compaction'
    | 'before_reset'
    | 'completion'
    | 'failure'
  summary: string
  handoffMarkdown: string
  stateSnapshotJson: string
  artifactRefs: string[]
  createdAt: number
}
```

### checkpoint 不是 backup dump

checkpoint 的目标不是把一切都原样复制一遍，而是保存：

1. 当前 run 真相
2. 当前 task 真相
3. 必要 artifact refs
4. 下一步需要什么
5. 恢复时最小 handoff 是什么

### checkpoint 应该服务什么动作

1. `Resume`
2. `Rollback`
3. `Branch`
4. `Reset + Handoff`

## 真相层级

建议明确以下优先级：

### Level 1: durable control truth

1. `HarnessRun`
2. `TaskNode`
3. `StepRecord`
4. `RunCheckpoint`

### Level 2: durable supporting truth

1. `MemoryRecord`
2. `RunTraceEvent`
3. `ArtifactRef`

### Level 3: narrative mirrors

1. assistant message blocks
2. tool call cards
3. compaction summary text

### Level 4: ephemeral runtime caches

1. `runtimeState`
2. `activeGenerations`
3. `abortControllers`
4. `resumingMessages`

规则：

1. 当 L1 与 L3 冲突时，以 L1 为准。
2. 当 L1 不存在时，才允许从 L3 重建近似状态。
3. 新设计中，L3 重建只能作为 fallback，而不应是主路径。

## 状态分层

## 1. Durable state

必须落盘：

1. run
2. task graph
3. step log
4. checkpoint
5. artifact refs
6. memory
7. trace

## 2. Derived state

可由 durable truth 计算：

1. 当前 active task title
2. progress done / total
3. current blocker summary
4. recovery suggestion
5. ticker one-line summary

建议 renderer 主要消费 derived snapshot，而不是原始表。

## 3. Ephemeral state

只为当前运行中的 loop 服务：

1. in-flight token stream
2. current tool abort controller
3. UI pause / hover / motion state
4. transient locks

规则：

1. ephemeral state 永远不作为恢复依据。
2. durable state 恢复时允许重建新的 ephemeral runtime。

## 状态机

## 1. `RunStatus` 语义

### `draft`

run 已创建，但尚未正式进入 planning/execution。

适用场景：

1. detached draft session
2. 准备发送但尚未启动的首轮任务

### `planning`

系统正在形成任务意图、拆分任务、准备上下文、建立初始 task graph。

### `ready`

run 已形成最小可执行结构，等待下一步执行。

### `executing`

当前 run 正在执行某个 bounded step。

### `waiting_permission`

run 因权限等待而暂停。必须能从 run 直接读取：

1. blocker 类型
2. blocker 对应 tool
3. 等待中的 request 信息

### `waiting_external`

run 因外部依赖等待而暂停，例如：

1. background process
2. remote callback
3. human follow-up

### `recovering`

run 正在从 checkpoint、handoff 或 blocker decision 中恢复。

### `evaluating`

模型认为任务已完成，但系统尚未通过 acceptance / verify gate。

### `completed`

任务达成，并且 completion gate 已通过。

### `failed`

run 无法继续推进，且当前未进入 recovery。

### `aborted`

用户主动中止，或系统安全终止。

## 2. `RunStage` 语义

`RunStage` 不和 status 重复，它代表任务语义阶段：

### `intent`

确认目标与约束。

### `plan`

形成 task graph 与执行方案。

### `task`

执行主要工作项。

### `verify`

进行验收与验证。

### `handoff`

为 compaction、pause、reset、resume 等场景准备交接。

## 3. 状态迁移规则

### 首次执行

```text
draft -> planning -> ready -> executing
```

### 权限阻塞

```text
executing -> waiting_permission -> recovering -> executing
```

### 外部等待

```text
executing -> waiting_external -> recovering -> executing
```

### 验收完成

```text
executing -> evaluating -> completed
```

### 验收失败 reopen

```text
executing -> evaluating -> executing
```

### 恢复失败

```text
recovering -> failed
```

### 用户取消

```text
planning/executing/waiting/recovering/evaluating -> aborted
```

## 状态提交策略

## 1. 什么时候必须 commit

以下事件必须触发 durable state commit：

1. run 创建
2. task 创建 / 更新 / 阻塞 / 完成
3. step 开始与结束
4. permission request 创建
5. permission decision 完成
6. question decision 完成
7. checkpoint 创建
8. completion 进入 evaluating
9. verifying pass / fail
10. recovery action 执行

## 2. commit 与 message update 的先后

原则：

1. 对控制逻辑重要的结果，先 commit state，再视情况刷新 narrative mirror。
2. narrative UI 可以稍晚，但不能反过来让 UI block 成为系统唯一真相。

### 推荐顺序

```text
action happens
  -> update durable state
  -> append trace
  -> mirror to message blocks / renderer events
```

## Checkpoint 策略

## 1. 必建 checkpoint 的时机

### `task_boundary`

在 task 切换前后建立，以支持：

1. reopen
2. rollback
3. branch

### `before_risky_tool`

在 destructive tool batch 之前建立。

### `before_wait`

在进入 `waiting_permission` 或 `waiting_external` 前建立。

### `before_compaction`

在 context shrink / reset 之前建立。

### `before_reset`

在 clear runtime / fresh context restart 之前建立。

### `completion`

在 run 完成后建立最终可查看 checkpoint。

### `failure`

在 run 失败前建立失败快照，以支持诊断与 branch。

## 2. checkpoint 内容边界

首轮不要尝试把所有 message 都塞进去。应优先包含：

1. run summary
2. active task
3. recent important steps
4. blocker / constraint
5. artifact refs
6. latest evidence refs
7. suggested next step

## 与当前模块的接线

## 1. `agentSessionPresenter`

它不负责具体状态机，只负责：

1. 暴露 run snapshot 查询
2. 暴露 run details 查询
3. 转发 recovery action 请求
4. 在 fork / retry / branch 时传递 lineage 信息

## 2. `agentRuntimePresenter`

它是 state kernel 的首要接入点：

1. 每次 `processMessage()` 前确保 active run
2. 每次 step 后 commit run state
3. 每次 wait / resume / completion 更新状态机

## 3. `process.ts`

它应逐步从“只管跑流”变成“按 step 运行并回写状态”的执行器。

不需要改成 planner，但需要：

1. 知道当前 run / task / step
2. 在 stop reason 发生时反馈结构化结果

## 4. `dispatch.ts`

tool interaction 是最容易造成状态漂移的地方，因此需要重点接 state kernel：

1. tool pre-check -> blocker state
2. tool result -> step result
3. permission decision -> decision step
4. batch resume -> recovery step

## renderer 应读什么

renderer 不应直接用 message block 重建完整 run truth，而应读：

1. `RunSnapshot`
2. `TaskNode[]`
3. `RunCheckpoint[]`
4. `RunTraceEvent[]`

message block 仍然保留，用于：

1. 聊天记录展示
2. inline tool narrative
3. compatibility fallback

## 首轮必须做到什么

如果要判断 State Kernel 首轮是否完成，最低要求不是“有表”，而是：

1. 每个 active task execution 都有 active run
2. permission wait 进入统一状态机
3. compaction / reset 能建立 checkpoint
4. completion 进入 evaluating，再决定 completed
5. 顶部 `Run Ticker` 能依赖 `RunSnapshot` 渲染，而不是拼 message

## 本文件结论

State Kernel 的本质不是加几个表，而是把 DeepChat 从：

```text
session + runtime cache + message narrative
```

提升为：

```text
session + durable run truth + derived snapshot + narrative mirror
```

没有这一步，memory、recovery、eval、observability 都会长期停留在不稳定的补丁形态。
