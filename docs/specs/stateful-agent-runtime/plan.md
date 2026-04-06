# Stateful Agent Runtime / Harness Redesign 实施计划

## 1. 关键决策

1. 不重写现有 execution engine，而是在 `agentRuntimePresenter` 之上增加 `Harness Kernel`。
2. `RunStateStore` 成为 run-level source of truth；现有 `runtimeState` 退化为 hot cache。
3. conversation/message 继续保留，但承担 narrative layer，而非 control truth。
4. 首轮先做 `State Kernel`，再做 `Memory Fabric`，再补 `Observability`，最后扩展 `Eval / Recovery / Policy`。
5. sidepanel 采用三个一级 tab：`run`、`workspace`、`browser`。
6. 顶部状态入口使用单行毛玻璃 `Run Ticker`，而不是复杂 status bar 或浮窗。
7. 完成态 `Run Ticker` 收起为轻量 `✓`，查看 `Run` tab 后消失。
8. 首轮 memory 实际优先级为 `working`、`episodic`、`evidence`；`semantic`、`procedural` 先建模、后严格开放写入。

## 2. 当前代码映射

### 2.1 保留不动的主干

1. `src/main/presenter/agentSessionPresenter/`
   - 继续负责 session lifecycle、IPC、fork / retry / delete / export 入口
2. `src/main/presenter/agentRuntimePresenter/`
   - 继续负责 runtime execution
3. `src/main/presenter/toolPresenter/`
   - 继续负责 tool routing
4. `src/main/presenter/llmProviderPresenter/`
   - 继续负责 provider 调用
5. `src/main/presenter/sessionPresenter/`
   - 继续作为 legacy compatibility layer

### 2.2 需要新增的内核层

建议新增在：

```text
src/main/presenter/agentRuntimePresenter/
├── runState/
│   ├── runStateManager.ts
│   ├── runStateStore.ts
│   ├── runSnapshotBuilder.ts
│   └── runStateTypes.ts
├── memory/
│   ├── memoryManager.ts
│   ├── memoryStore.ts
│   ├── retrievalPlanner.ts
│   └── memoryTypes.ts
├── checkpoints/
│   ├── checkpointManager.ts
│   ├── checkpointStore.ts
│   └── handoffBuilder.ts
└── tracing/
    ├── traceEventStore.ts
    └── runMetrics.ts
```

这些模块不应该把已有 `process.ts`、`dispatch.ts` 推翻，而应提供：

1. 执行前的 run state resolve
2. 执行后的 state commit
3. checkpoint / memory / trace side effects
4. renderer 可消费的 run snapshot

## 3. 目标架构

```text
Renderer
  -> agentSessionPresenter
  -> agentRuntimePresenter
      -> RunStateManager
      -> MemoryManager
      -> CheckpointManager
      -> process.ts / dispatch.ts
      -> ToolPresenter / llmProviderPresenter
      -> MessageStore / SessionStore / RunStateStore / MemoryStore
```

核心时序：

```text
user action
  -> agentSessionPresenter
  -> agentRuntimePresenter
  -> RunStateManager.ensureActiveRun()
  -> MemoryManager.buildWorkingSet()
  -> process one bounded step
  -> RunStateManager.commitStep()
  -> CheckpointManager.maybeCreateCheckpoint()
  -> MemoryManager.maybeWriteMemory()
  -> TraceEventStore.append()
  -> emit RunSnapshot to renderer
```

## 4. 数据模型设计

### 4.1 Shared type proposals

建议在 `src/shared/types/agent-interface.d.ts` 或独立 shared type 文件中增加：

```ts
export type RunStatus =
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

export type RunStage = 'intent' | 'plan' | 'task' | 'verify' | 'handoff'

export interface HarnessRun {
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
  createdAt: number
  updatedAt: number
  startedAt?: number | null
  completedAt?: number | null
}

export type RunTaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'failed' | 'skipped'

export interface TaskNode {
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
  lastUpdatedAt: number
  createdAt: number
}

export interface StepRecord {
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

export interface RunCheckpoint {
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

export type MemoryScope = 'working' | 'episodic' | 'semantic' | 'procedural' | 'evidence'

export interface MemoryRecord {
  id: string
  scope: MemoryScope
  runId?: string | null
  sessionId?: string | null
  workspaceId?: string | null
  taskId?: string | null
  sourceStepId?: string | null
  kind: 'fact' | 'decision' | 'constraint' | 'failure' | 'preference' | 'artifact'
  summary: string
  payloadUri?: string | null
  evidenceRefs: string[]
  confidence: number
  freshness: 'volatile' | 'stable'
  supersedes: string[]
  createdAt: number
  expiresAt?: number | null
}

export interface RunTraceEvent {
  id: string
  runId: string
  taskId?: string | null
  stepId?: string | null
  type:
    | 'state_transition'
    | 'tool_call'
    | 'tool_result'
    | 'memory_write'
    | 'checkpoint'
    | 'eval'
  ts: number
  payloadJson: string
}
```

### 4.2 SQLite tables

建议分 phase 上表，避免一次性引入过多表和迁移风险。

#### Phase 1 tables

##### `deepchat_runs`

字段：

1. `id TEXT PRIMARY KEY`
2. `session_id TEXT NOT NULL`
3. `parent_run_id TEXT`
4. `origin_checkpoint_id TEXT`
5. `title TEXT NOT NULL`
6. `goal TEXT NOT NULL`
7. `status TEXT NOT NULL`
8. `stage TEXT NOT NULL`
9. `current_task_id TEXT`
10. `current_step_id TEXT`
11. `active_checkpoint_id TEXT`
12. `environment_id TEXT`
13. `trigger_message_id TEXT`
14. `started_at INTEGER`
15. `completed_at INTEGER`
16. `created_at INTEGER NOT NULL`
17. `updated_at INTEGER NOT NULL`

索引：

1. `idx_deepchat_runs_session_updated (session_id, updated_at DESC)`
2. `idx_deepchat_runs_session_status (session_id, status, updated_at DESC)`

##### `deepchat_run_tasks`

字段：

1. `id TEXT PRIMARY KEY`
2. `run_id TEXT NOT NULL`
3. `title TEXT NOT NULL`
4. `description TEXT`
5. `status TEXT NOT NULL`
6. `acceptance_json TEXT NOT NULL`
7. `depends_on_json TEXT NOT NULL`
8. `owner TEXT NOT NULL`
9. `order_index INTEGER NOT NULL`
10. `blocker_reason TEXT`
11. `created_at INTEGER NOT NULL`
12. `updated_at INTEGER NOT NULL`
13. `last_updated_at INTEGER NOT NULL`

索引：

1. `idx_deepchat_run_tasks_run_order (run_id, order_index ASC)`
2. `idx_deepchat_run_tasks_run_status (run_id, status, updated_at DESC)`

##### `deepchat_run_steps`

字段：

1. `id TEXT PRIMARY KEY`
2. `run_id TEXT NOT NULL`
3. `task_id TEXT`
4. `action_type TEXT NOT NULL`
5. `status TEXT NOT NULL`
6. `summary TEXT NOT NULL`
7. `input_ref TEXT`
8. `output_ref TEXT`
9. `payload_json TEXT`
10. `started_at INTEGER NOT NULL`
11. `ended_at INTEGER`
12. `created_at INTEGER NOT NULL`

索引：

1. `idx_deepchat_run_steps_run_time (run_id, started_at ASC)`
2. `idx_deepchat_run_steps_task_time (task_id, started_at ASC)`

##### `deepchat_run_checkpoints`

字段：

1. `id TEXT PRIMARY KEY`
2. `run_id TEXT NOT NULL`
3. `step_id TEXT`
4. `kind TEXT NOT NULL`
5. `summary TEXT NOT NULL`
6. `handoff_markdown TEXT NOT NULL`
7. `state_snapshot_json TEXT NOT NULL`
8. `artifact_refs_json TEXT NOT NULL`
9. `created_at INTEGER NOT NULL`

索引：

1. `idx_deepchat_run_checkpoints_run_time (run_id, created_at DESC)`

##### `deepchat_run_artifacts`

字段：

1. `id TEXT PRIMARY KEY`
2. `run_id TEXT NOT NULL`
3. `task_id TEXT`
4. `source_message_id TEXT`
5. `kind TEXT NOT NULL`
6. `title TEXT NOT NULL`
7. `uri TEXT NOT NULL`
8. `metadata_json TEXT`
9. `created_at INTEGER NOT NULL`

索引：

1. `idx_deepchat_run_artifacts_run_time (run_id, created_at DESC)`

#### Phase 2 tables

##### `deepchat_memory_records`

字段：

1. `id TEXT PRIMARY KEY`
2. `scope TEXT NOT NULL`
3. `run_id TEXT`
4. `session_id TEXT`
5. `workspace_id TEXT`
6. `task_id TEXT`
7. `source_step_id TEXT`
8. `kind TEXT NOT NULL`
9. `summary TEXT NOT NULL`
10. `payload_uri TEXT`
11. `evidence_refs_json TEXT NOT NULL`
12. `confidence REAL NOT NULL`
13. `freshness TEXT NOT NULL`
14. `supersedes_json TEXT NOT NULL`
15. `expires_at INTEGER`
16. `created_at INTEGER NOT NULL`

索引：

1. `idx_deepchat_memory_records_scope_created (scope, created_at DESC)`
2. `idx_deepchat_memory_records_run_scope (run_id, scope, created_at DESC)`
3. `idx_deepchat_memory_records_session_scope (session_id, scope, created_at DESC)`

#### Phase 3 tables

##### `deepchat_trace_events`

字段：

1. `id TEXT PRIMARY KEY`
2. `run_id TEXT NOT NULL`
3. `task_id TEXT`
4. `step_id TEXT`
5. `type TEXT NOT NULL`
6. `ts INTEGER NOT NULL`
7. `payload_json TEXT NOT NULL`

索引：

1. `idx_deepchat_trace_events_run_time (run_id, ts ASC)`
2. `idx_deepchat_trace_events_step_time (step_id, ts ASC)`

## 5. 状态分层策略

### 5.1 Durable state

落盘内容：

1. run / task / step / checkpoint / artifact
2. memory
3. trace
4. recovery / eval outcome

### 5.2 Derived state

在 main 端由 `runSnapshotBuilder` 统一生成：

1. `activeTaskTitle`
2. `progressDone`
3. `progressTotal`
4. `blocker`
5. `suggestedRecoveryAction`
6. `tickerSummary`

### 5.3 Ephemeral state

仍留在 `agentRuntimePresenter`：

1. abort controllers
2. active generation handles
3. stream buffers
4. UI animation / pending hover / collapse acknowledgment

要求：

1. derived state 允许重算，不落单独真相表。
2. renderer 主要消费 `RunSnapshot`，不直接拼装原始 step 列表作为状态入口。

## 6. Main 侧接入计划

### 6.1 `agentSessionPresenter`

新增职责：

1. 代理 run snapshot 查询
2. 代理 run timeline 查询
3. 代理 run recovery action
4. 会话切换 / fork / retry 时把 run lineage 关系正确传给 runtime

建议新增接口：

1. `getActiveRunSnapshot(sessionId: string): Promise<RunSnapshot | null>`
2. `listRunTasks(runId: string): Promise<TaskNode[]>`
3. `listRunCheckpoints(runId: string): Promise<RunCheckpoint[]>`
4. `listRunTraceEvents(runId: string): Promise<RunTraceEvent[]>`
5. `performRunRecovery(runId: string, action: RunRecoveryAction): Promise<void>`

### 6.2 `agentRuntimePresenter`

需要改造的核心点：

1. `processMessage()` 开始前先 `ensureActiveRun()`
2. `process.ts` 执行 step 之前读取 working set
3. `dispatch.ts` 每次 tool call / tool result / permission decision 后写 `StepRecord`
4. `setSessionStatus()` 不再是唯一状态真相，只同步 coarse session state
5. compaction 与 resume 路径调用 `CheckpointManager`
6. `emitDeepChatInternalSessionUpdate()` 同步 run snapshot 事件

需要保留的现有行为：

1. message persistence
2. streaming assistant block 更新
3. pending interaction overlay
4. pending input queue
5. tool output guard

需要提升抽象的现有行为：

1. permission pending -> `RunStatus = waiting_permission`
2. external wait -> `RunStatus = waiting_external`
3. compaction / reset -> `RunStage = handoff`
4. completion -> `RunStatus = evaluating | completed`

### 6.3 `process.ts`

建议改造点：

1. 每轮 stream loop 获得一个 `stepId`
2. stop reason、tool batch result、final answer 归档为 step 输出
3. `MAX_TOOL_CALLS` 命中时，写入 failure step 与 recovery hint，而不是只有 error content
4. `completedToolCalls` 同步映射到 step / artifact / evidence

### 6.4 `dispatch.ts`

建议改造点：

1. tool pre-check / permission request 结果同时写 message block 与 run blocker
2. granted / denied / resumed 都落 `StepRecord`
3. batch tool completion后触发同步 state commit
4. `respondToolInteraction()` 恢复时必须在 run state 中解除 blocker 并建立 checkpoint

## 7. 执行循环与状态迁移

### 7.1 标准执行路径

```text
sendMessage
  -> ensureActiveRun(status='planning'|'executing')
  -> derive / refresh TaskNode
  -> build working set
  -> execute bounded step
  -> commit StepRecord
  -> maybe write ArtifactRef / MemoryRecord / Checkpoint
  -> transition run status
```

### 7.2 permission 路径

```text
tool pre-check detects permission required
  -> assistant block pending
  -> run status = waiting_permission
  -> run blocker = permission payload
  -> create before_wait checkpoint
  -> renderer shows blocking summary

user grants/denies
  -> write decision step
  -> clear blocker
  -> run status = recovering
  -> replay batch / continue step
```

### 7.3 compaction / reset 路径

```text
context budget pressure
  -> checkpoint before_compaction
  -> generate handoff
  -> compact / reset
  -> rebuild working set from checkpoint + memory
  -> continue with new step
```

### 7.4 completion 路径

```text
model claims done
  -> run enters evaluating
  -> acceptance criteria / verify pass
  -> completion checkpoint
  -> run status = completed
  -> renderer ticker collapses to ✓
```

如果 verify 不通过：

```text
evaluating
  -> task reopen
  -> run status = executing
  -> ticker returns to normal summary
```

## 8. Memory Fabric 计划

### 8.1 Write policy

只在高信号时刻写 memory：

1. task 被创建或拆分
2. task 被标记 done / failed / blocked
3. 用户表达明确偏好
4. permission 被拒绝或 granted 且具有长期影响
5. 测试、验证、diff、截图等 evidence 产生
6. compaction / handoff 发生
7. repeated failure 被识别

Scope gating：

1. `working`
   - 由 retrieval 动态构造，可落轻量索引但不作为长期历史主存
2. `episodic`
   - 默认接收决策、失败、阶段性结论
3. `evidence`
   - 保存文件、trace、test、diff、screenshot、log 引用
4. `semantic`
   - 仅允许高 confidence 且有 evidence 的稳定事实
5. `procedural`
   - 仅允许多次验证后的流程性偏好

### 8.2 Retrieval policy

retrieval 输入至少包含：

1. `run.status`
2. `run.stage`
3. `currentTaskId`
4. `environmentId`
5. recent failures
6. current blocker
7. explicit user goal

构建 working set 的顺序建议：

```text
state snapshot
  + active task
  + latest checkpoint
  + recent episodic memory
  + scoped semantic/procedural memory
  + required evidence refs
  = working set
```

## 9. Checkpoint / Handoff 计划

### 9.1 Checkpoint payload

每个 checkpoint 至少包含：

1. run summary
2. active task snapshot
3. open blockers
4. recent important steps
5. required artifact refs
6. recovery hint
7. handoff markdown

### 9.2 Handoff 内容模板

handoff 不能只是“自然语言简述”，至少要包含：

1. goal
2. current status / stage
3. active task
4. completed tasks
5. remaining tasks
6. blocker
7. latest evidence
8. next step suggestion

## 10. Renderer 计划

### 10.1 状态源

renderer 不直接从 message blocks 猜完整 run 状态，优先消费：

1. `RunSnapshot`
2. `TaskNode[]`
3. `RunCheckpoint[]`
4. `RunTraceEvent[]`

message blocks 仍用于：

1. narrative rendering
2. inline permission / question interaction
3. tool output display

### 10.2 `Run Ticker`

新增建议组件：

1. `src/renderer/src/components/chat/RunTicker.vue`

插入位置：

1. `ChatPage.vue`
2. 位于 `ChatTopBar` 下方
3. 采用类似 `ChatSearchBar` 的 sticky overlay 模式

行为：

1. `idle` / no run：隐藏
2. `planning` / `executing` / `recovering` / `evaluating`：显示完整 ticker
3. `waiting_permission` / `waiting_external` / `failed`：固定显示，不滚动
4. `completed`：收起成 `✓`
5. 点击 `✓` 后打开 `Run` tab 并消失
6. hover 时暂停滚动

建议结构：

```text
[fixed status] [scrolling summary] [open affordance]
```

而不是整条一起滚动。

### 10.3 Sidepanel

需要改造：

1. `ChatSidePanel.vue`
2. `useSidepanelStore`

状态模型调整为：

```ts
type SidepanelTab = 'run' | 'workspace' | 'browser'
```

新增组件：

1. `components/sidepanel/RunPanel.vue`
2. `components/sidepanel/RunTaskList.vue`
3. `components/sidepanel/RunTimeline.vue`
4. `components/sidepanel/RunRecoveryBar.vue`

`RunPanel` 首轮至少展示：

1. Goal
2. Status / Stage / Progress
3. Current task
4. Task list
5. Active checkpoint
6. Blocker
7. Recent timeline
8. Recovery actions

### 10.4 ChatTopBar

`ChatTopBar.vue` 保持简洁，不直接塞复杂 run 状态，只需要：

1. 保留现有 `Workspace` 按钮
2. 未来可由 `Run Ticker` 点击驱动 sidepanel open to `run`

## 11. 兼容策略

1. `DeepChatSessionState` 继续保留 coarse `status`
2. session list、floating widget 初期可继续读 coarse 状态
3. 有新 `RunSnapshot` 后，列表类 UI 逐步切换为读取 derived state
4. 旧 `traceCount`、message metadata、summary state 不回退

## 12. 分阶段实施

### Phase 1: State Kernel

交付：

1. `deepchat_runs`
2. `deepchat_run_tasks`
3. `deepchat_run_steps`
4. `deepchat_run_checkpoints`
5. `RunStateManager`
6. `RunSnapshot`

退出标准：

1. run 可以被创建、更新、恢复
2. permission / wait / failure 进入统一状态机

### Phase 2: Memory Fabric

交付：

1. `deepchat_memory_records`
2. `MemoryManager`
3. `retrievalPlanner`
4. working / episodic / evidence 写入与读取

退出标准：

1. working set 不再主要依赖 transcript 全量回灌

### Phase 3: Checkpoint / Handoff / Recovery baseline

交付：

1. handoff builder
2. checkpoint policy
3. resume / rollback / branch / reset baseline

退出标准：

1. compaction / reset / wait 后可以按 checkpoint 恢复

### Phase 4: Observability baseline

交付：

1. `deepchat_trace_events`
2. timeline query
3. run metrics

退出标准：

1. 能复盘状态迁移与关键 step

### Phase 5: Eval / Policy expansion

交付：

1. grader inputs
2. policy gating
3. quality constraints

退出标准：

1. completed 质量更可验证

## 13. 测试策略

### Main

1. SQLite migration tests
   - 新表建表、索引、升级
2. `RunStateManager`
   - create / reopen / complete / fail / abort / branch
3. `CheckpointManager`
   - before_wait / before_compaction / completion
4. `MemoryManager`
   - scope gating、evidence requirement、supersede、retrieval
5. execution integration
   - permission wait -> resume
   - compaction -> handoff -> continue
   - false done prevention
6. trace
   - step timeline 完整性

### Renderer

1. `Run Ticker`
   - 隐藏/显示
   - blocked pinning
   - completion -> `✓`
   - click `✓` -> open `Run` tab -> disappear
2. sidepanel
   - tab 切换
   - `Run` panel 展示
   - ticker 点击跳转
3. i18n
   - 新文案覆盖

### Integration

1. regular session start -> active run
2. tool permission batch -> waiting -> resume
3. compaction / resume
4. completed verify fail -> reopen task
5. completed verify pass -> ticker checkmark flow

## 14. 风险与缓解

1. 风险：run state 与 message block 双写后产生状态漂移
   - 缓解：明确 `RunStateStore` 为真相，message block 只做 narrative mirror
2. 风险：首轮数据模型过重，拖慢迭代
   - 缓解：按 phase 分表与分模块实施
3. 风险：UI 过度设计，打断聊天体验
   - 缓解：顶部只做单行 `Run Ticker`，细节集中在 `Run` tab
4. 风险：memory 过早写入低质量“事实”
   - 缓解：scope gating + confidence + evidence requirement
5. 风险：恢复语义复杂，用户无法理解
   - 缓解：只提供固定 recovery actions，不暴露内部复杂分支细节

## 15. 回退策略

1. schema 采用 additive migration，新表不影响旧聊天能力。
2. `Run Ticker` 与 `Run` tab 可通过 feature flag 关闭。
3. 即使新 run store 暂时关闭，原 `agentRuntimePresenter` 聊天执行链路仍然可继续运行。
