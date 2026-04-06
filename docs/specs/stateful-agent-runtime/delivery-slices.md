# Delivery Slices

## 目的

本文件把 stateful runtime redesign 拆成适合落地的交付切片，避免出现“理论正确，但第一刀太大”的问题。

目标不是追求文档上的 phase 完整，而是为实际 PR 顺序、测试顺序、回退顺序提供建议。

## 切片原则

### 1. 先建立真相层，再改 UI

如果先做 UI，再补状态真相，最后 UI 一定返工。

### 2. 先做 additive schema，再做状态切换

所有新表、新类型、新接口，尽量先加不切，再逐步切换读写路径。

### 3. 先做最小闭环，不做一锅端

每个 slice 都应该能回答：

1. 新增了什么 durable truth
2. execution plane 多接了一段什么能力
3. renderer 多消费了什么新状态

### 4. 保留 fallback path

每一阶段都应尽量允许：

1. feature flag 关闭
2. coarse session status 继续工作
3. message narrative 继续工作

## 推荐切片

## Slice 0: 文档与命名冻结

### 目标

先把术语、边界、UI 共识固定下来，避免实现中不断改名。

### 交付

1. `spec.md`
2. `plan.md`
3. `tasks.md`
4. 本专题拆分文档

### Definition of Done

1. `Run Ticker`
2. `Run / Workspace / Browser`
3. `completed -> ✓ -> open Run -> disappear`

这些名词和交互不再反复漂移。

## Slice 1: Shared contracts + schema skeleton

### 目标

先建立 shared types 与 SQLite 表结构，不改变 execution 行为。

### 交付

1. `HarnessRun` / `TaskNode` / `StepRecord` / `RunCheckpoint`
2. `MemoryRecord` / `RunTraceEvent`
3. `RunSnapshot`
4. `deepchat_runs`
5. `deepchat_run_tasks`
6. `deepchat_run_steps`
7. `deepchat_run_checkpoints`
8. `deepchat_run_artifacts`

### 不包含

1. 真正切 execution path
2. renderer 新 UI

### 测试

1. migration
2. CRUD
3. serialization

## Slice 2: RunStateStore + RunSnapshotBuilder

### 目标

先让系统能创建和读取 active run，但暂时只做最小映射。

### 交付

1. `RunStateStore`
2. `RunStateManager`
3. `RunSnapshotBuilder`
4. session -> active run 查询接口

### 范围

先映射：

1. run create
2. run status
3. current task placeholder
4. checkpoint placeholder

### DoD

1. regular session 发送消息时能创建 active run
2. renderer 能查询到 run snapshot

## Slice 3: permission / wait 状态机接线

### 目标

优先收敛最容易出问题的路径：`waiting_permission` 与 resume。

### 交付

1. permission pending -> `RunStatus.waiting_permission`
2. blocker state 落盘
3. decision step 落盘
4. before-wait checkpoint
5. resume -> recovering -> executing

### 为什么先做这个

因为这条链路最能直接证明：

1. state kernel 不是摆设
2. 恢复路径确实更稳

### DoD

1. 用户批准/拒绝后，run 状态迁移正确
2. `RunSnapshot` 能告诉 UI 当前阻塞点
3. 相应 integration test 通过

## Slice 4: StepRecord 与 completion gate

### 目标

让 bounded step execution 真正成立，并把 completed 从“文本决定”改成“状态决定”。

### 交付

1. step create / complete / fail
2. tool_call / tool_result step
3. completion -> evaluating
4. verify pass -> completed
5. verify fail -> reopen task

### DoD

1. 至少一个主路径任务能完整走 `executing -> evaluating -> completed`
2. 至少一个失败场景能 reopen

## Slice 5: Checkpoint + Handoff

### 目标

让 state kernel 真正具备恢复价值。

### 交付

1. `CheckpointManager`
2. `handoffBuilder`
3. `before_compaction` / `completion` / `failure` checkpoint
4. resume from checkpoint baseline

### DoD

1. compaction 发生前后有 checkpoint
2. 至少一条 reset + handoff 路径可用

## Slice 6: Memory baseline

### 目标

引入最小 Memory Fabric，但只实现最有价值的部分。

### 交付

1. `deepchat_memory_records`
2. `MemoryStore`
3. `MemoryManager`
4. `working` retrieval
5. `episodic` write/read
6. `evidence` write/read

### 不建议首刀做的

1. semantic 大规模自动写入
2. procedural 自动归纳

### DoD

1. working set 已不主要依赖 transcript replay
2. checkpoint / handoff 能引用 memory

## Slice 7: Renderer `Run Ticker`

### 目标

在状态真相基本可用后，再把顶部状态入口接出来。

### 交付

1. `RunTicker.vue`
2. 状态/摘要/展开 affordance
3. blocked 固定
4. completed 收起为 `✓`

### DoD

1. ticker 由 `RunSnapshot` 驱动
2. `✓` 交互完整可用

## Slice 8: Sidepanel `Run` tab

### 目标

建立完整详情面。

### 交付

1. `run | workspace | browser` 三 tab
2. `RunPanel`
3. `RunTaskList`
4. `RunTimeline`
5. `RunRecoveryBar`

### DoD

1. ticker 点击可直达 `Run`
2. `Run` tab 可以独立展示任务与恢复信息

## Slice 9: Trace + recovery action baseline

### 目标

补齐反馈系统与标准恢复动作。

### 交付

1. `deepchat_trace_events`
2. timeline query
3. fixed recovery actions
4. recovery suggestion

### DoD

1. 用户和开发者都能复盘一次 run 的关键迁移
2. 至少一个 recovery action 真正可执行

## Slice 10: Eval / policy 扩展

### 目标

把前面建立的 state / trace / memory 用于质量治理。

### 交付

1. verifier input normalization
2. outcome / artifact / trace grader input
3. policy gates

### 注意

这必须是后置切片，不要提前拉高复杂度。

## 建议 PR 顺序

如果按更现实的 PR 粒度拆，建议：

1. PR1: shared types + schema
2. PR2: `RunStateStore` + `RunSnapshot`
3. PR3: permission wait state machine
4. PR4: step records + completion gate
5. PR5: checkpoints + handoff
6. PR6: memory baseline
7. PR7: `Run Ticker`
8. PR8: sidepanel `Run` tab
9. PR9: trace + recovery actions
10. PR10: eval / policy expansion

## 每个 PR 都要满足的最小标准

1. 有明确 spec 对应关系
2. 有 schema / type / runtime / renderer 的边界说明
3. 有主路径测试
4. 有回退路径说明

## 风险控制

## 1. 防止 schema 一次上太多

策略：

1. runs/tasks/steps/checkpoints 先上
2. memory/traces 后上

## 2. 防止 execution 与 UI 同时大改

策略：

1. 先稳定 main path
2. 再接 renderer

## 3. 防止 memory 质量失控

策略：

1. 先 episodic/evidence
2. semantic/procedural 延后严格开放

## 4. 防止 completed 语义漂移

策略：

1. 先引入 `evaluating`
2. 不允许直接从 `executing` 跳到 `completed`

## Phase Definition of Done

## Phase 1 DoD

1. active run 可创建与查询
2. permission wait 状态机成立
3. completion 不再只靠文本声明

## Phase 2 DoD

1. checkpoint / handoff 可用
2. memory baseline 可用
3. 至少一条 reset + handoff 路径通过测试

## Phase 3 DoD

1. `Run Ticker` 与 `Run` tab 可用
2. trace 与 recovery action baseline 可用

## Phase 4 DoD

1. eval / policy expansion 可以建立在已有真相层上

## 本文件结论

这次 redesign 的关键，不是理论上把蓝图画全，而是把第一刀切准：

1. 先切真相层
2. 再切恢复层
3. 最后切展示层与治理层

只要切片顺序对，DeepChat 就能在不推翻现有 runtime 的情况下，逐步长出真正可靠的 task execution 内核。
