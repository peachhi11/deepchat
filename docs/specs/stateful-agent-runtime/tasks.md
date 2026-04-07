# Stateful Agent Runtime / Harness Redesign 任务清单

> 当前实施状态与验证记录见 [`progress.md`](./progress.md)。

## 实施步进追踪

- [x] Step 1: Minimal Run Truth
- [ ] Step 2: Active Run Lifecycle
- [ ] Step 3: Permission Wait Backbone
- [ ] Step 4: Structured Step Log
- [ ] Step 5: Checkpoint + Handoff on Compaction
- [ ] Step 6: Memory Baseline
- [ ] Step 7: Single-Root Task + Completion Gate
- [ ] Step 8: Run Ticker
- [ ] Step 9: Run Tab + Trace + Recovery UI

## T0 规格文档

- [x] 创建 `docs/specs/stateful-agent-runtime/README.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/spec.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/plan.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/tasks.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/current-state-audit.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/state-kernel.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/memory-fabric.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/ux-surfaces.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/observability-and-recovery.md`
- [x] 创建 `docs/specs/stateful-agent-runtime/delivery-slices.md`

## T1 Shared contracts 与数据层骨架

- [x] 新增 `RunStatus`、`RunStage`、`HarnessRun`
- [ ] 新增 `TaskNode`、`StepRecord`、`RunCheckpoint`
- [ ] 新增 `MemoryScope`、`MemoryRecord`、`RunTraceEvent`
- [x] 新增 `RunSnapshot`
- [x] 新增 `deepchat_runs` table
- [ ] 新增 `deepchat_run_tasks` table
- [ ] 新增 `deepchat_run_steps` table
- [ ] 新增 `deepchat_run_checkpoints` table
- [ ] 新增 `deepchat_run_artifacts` table
- [x] 新增 `DeepChatRunStore`
- [x] 在 `SQLitePresenter` 中注册 `deepchat_runs` 表与迁移版本

## T2 Main State Kernel

- [ ] 新增 `RunStateStore`
- [ ] 新增 `RunStateManager`
- [ ] 实现 `ensureActiveRun(sessionId, trigger)` 逻辑
- [ ] 实现 run status / stage 状态迁移 helper
- [ ] 将 permission / external wait / abort / fail 映射到统一 run 状态机
- [ ] 让 `runtimeState` 从 run 真相降级为 hot cache
- [ ] 新增 `RunSnapshotBuilder`
- [ ] 向 renderer 发出 `RunSnapshot` 更新事件

## T3 执行循环接线

- [ ] `agentRuntimePresenter.processMessage()` 开始前接入 `RunStateManager`
- [ ] `process.ts` 每轮 step 生成 `stepId`
- [ ] `dispatch.ts` 的 tool_call / tool_result / permission decision 写入 `StepRecord`
- [ ] completion 路径先进入 `evaluating`，再决定 `completed` 或 reopen
- [ ] `MAX_TOOL_CALLS`、abort、provider error 都能产出结构化 failure step

## T4 Checkpoint 与 Handoff

- [ ] 新增 `CheckpointStore`
- [ ] 新增 `CheckpointManager`
- [ ] 在 `before_wait` 场景生成 checkpoint
- [ ] 在 `before_compaction` / `before_reset` 场景生成 checkpoint
- [ ] 在 `completed` / `failed` 场景生成 checkpoint
- [ ] 新增 `handoffBuilder`
- [ ] 在 compaction / reset / recovery 路径中读取 handoff 而不是只读 transcript

## T5 Memory Fabric

- [ ] 新增 `deepchat_memory_records` table
- [ ] 新增 `MemoryStore`
- [ ] 新增 `MemoryManager`
- [ ] 新增 `retrievalPlanner`
- [ ] 实现 `working` / `episodic` / `evidence` 首轮写入策略
- [ ] 实现 `confidence` / `freshness` / `supersedes` 字段约束
- [ ] 为 `semantic` / `procedural` 建立严格写入门槛
- [ ] working set 改为 state-aware retrieval 构建

## T6 Observability baseline

- [ ] 新增 `deepchat_trace_events` table
- [ ] 新增 `TraceEventStore`
- [ ] 为 state transition、tool call、tool result、checkpoint、memory write 记录 trace
- [ ] 新增 run timeline 查询接口
- [ ] 新增基础 metrics 统计

## T7 Renderer: `Run Ticker`

- [ ] 新增 `src/renderer/src/components/chat/RunTicker.vue`
- [ ] 在 `ChatPage.vue` 中插入 `Run Ticker`
- [ ] `Run Ticker` 支持单行窄宽毛玻璃胶囊样式
- [ ] `Run Ticker` 支持中段摘要缓慢滚动
- [ ] `hover` 时暂停滚动
- [ ] `waiting_permission` / `waiting_external` / `failed` 时固定显示，不滚动
- [ ] `completed` 时收起成 `✓`
- [ ] 点击 `✓` 后打开 `Run` tab 并消失
- [ ] 为新文案增加 i18n key

## T8 Renderer: Right Sidepanel `Run / Workspace / Browser`

- [ ] 将 `SidepanelTab` 从 `workspace | browser` 扩展为 `run | workspace | browser`
- [ ] 改造 `ChatSidePanel.vue` 顶部 tab UI
- [ ] 新增 `RunPanel.vue`
- [ ] 新增 `RunTaskList.vue`
- [ ] 新增 `RunTimeline.vue`
- [ ] 新增 `RunRecoveryBar.vue`
- [ ] ticker 点击时直接打开 `Run` tab
- [ ] run 完成后的 `✓` 查看后消失逻辑接入 sidepanel state

## T9 Session / Presenter 接口扩展

- [ ] `agentSessionPresenter` 暴露 active run snapshot 查询接口
- [ ] `agentSessionPresenter` 暴露 task / checkpoint / trace 查询接口
- [ ] `agentSessionPresenter` 暴露 recovery action 接口
- [ ] renderer `sessionStore` / 相关 store 接入 run snapshot

## T10 Recovery baseline

- [ ] 实现 `Resume`
- [ ] 实现 `Rollback`
- [ ] 实现 `Branch`
- [ ] 实现 `Reset + Handoff`
- [ ] 实现 `Safe Mode`
- [ ] 在 `Run` panel 中展示推荐 recovery action

## T11 Compatibility / Migration

- [ ] 确保旧 session / message / export / spotlight 能继续工作
- [ ] 保持 coarse session status 兼容现有 session list
- [ ] 确保新表删除 / 清理策略不会误删旧数据
- [ ] 为 feature flag / fallback path 留出开关

## T12 测试

- [ ] Main：新表迁移与 CRUD
- [ ] Main：run 状态迁移测试
- [ ] Main：checkpoint / handoff / recovery 测试
- [ ] Main：memory write / retrieval / evidence gating 测试
- [ ] Main：trace timeline 测试
- [ ] Renderer：`Run Ticker` 行为测试
- [ ] Renderer：sidepanel `Run` tab 测试
- [ ] Integration：permission wait -> resume
- [ ] Integration：compaction -> handoff -> continue
- [ ] Integration：completed -> `✓` -> open `Run` -> disappear

## T13 质量门禁

- [ ] `pnpm run format`
- [ ] `pnpm run i18n`
- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] 运行相关 main / renderer / integration 测试并记录结果
