# Stateful Agent Runtime 实施进度

最后更新：2026-04-07

## 当前状态

| Step | 状态 | 结论 |
| --- | --- | --- |
| Step 1: Minimal Run Truth | 已完成 | 已补 shared run contracts、`deepchat_runs` durable schema、`DeepChatRunStore`，并把 runtime 内部的 ephemeral `runId` 去歧义为 `generationId`。 |
| Step 2: Active Run Lifecycle | 已完成 | 已补 `RunStateManager`、`RunSnapshotBuilder`、`getActiveRunSnapshot()` 与 `RUN_SNAPSHOT_UPDATED`，regular DeepChat session 现在会生成 durable active run snapshot。 |
| Step 3: Permission Wait Backbone | 已完成 | 已补 `deepchat_run_steps`、`deepchat_run_checkpoints`、permission wait checkpoint / step / decision durable truth，并把 grant / deny / resume 接回 run snapshot。 |
| Step 4: Structured Step Log | 已完成 | 已补 `tool_call` / `tool_result` / `failure` / `aborted` durable step log，`MAX_TOOL_CALLS` 现在会明确失败，不再伪装成完成。 |
| Step 5: Checkpoint + Handoff on Compaction | 已完成 | 已补 `before_compaction` / `before_reset` / `failure` checkpoint producer，且 compaction、retry reset、resume recovery 都已开始消费 handoff。 |

## Step 1 交付

- 新增 shared contracts：`RunStatus`、`RunStage`、`HarnessRun`、`RunSnapshot`
- 新增 SQLite 表：`deepchat_runs`
- 新增 main store：`src/main/presenter/agentRuntimePresenter/runStore.ts`
- 在 `SQLitePresenter` 中注册 `deepchat_runs` 建表、迁移与清理
- 将 `AgentRuntimePresenter` 内部 active generation 的 `runId` 重命名为 `generationId`
- 补充 Step 1 相关测试：
  - `test/main/presenter/agentRuntimePresenter/runStore.test.ts`
  - `test/main/presenter/sqlitePresenter.test.ts`
- 受影响回归：
  - `test/main/presenter/agentRuntimePresenter/agentRuntimePresenter.test.ts`
  - `test/main/presenter/remoteControlPresenter/remoteConversationRunner.test.ts`

## Step 2 交付

- 新增 main state kernel：
  - `src/main/presenter/agentRuntimePresenter/runStateManager.ts`
  - `src/main/presenter/agentRuntimePresenter/runSnapshotBuilder.ts`
- `AgentRuntimePresenter.processMessage()` / `resumeAssistantMessage()` / `cancelGeneration()` 接入 active run lifecycle
- `AgentRuntimePresenter` 暴露 `getActiveRunSnapshot(sessionId)`
- `AgentSessionPresenter` 暴露 `getActiveRunSnapshot(sessionId)`
- 新增 session-level renderer event：`SESSION_EVENTS.RUN_SNAPSHOT_UPDATED`
- `ChatPage.vue` 接入 active run snapshot 加载与事件订阅
- 新增最小可见 UI：`src/renderer/src/components/chat/RunTicker.vue`
- 行为变化：
  - regular DeepChat session 首次发送消息后会创建 durable run row
  - 同一 session 的连续 turn 会复用最新 non-terminal run，并刷新 `title/goal`
  - 完成、失败、取消都会刷新对应 run snapshot

## Step 2 UI 形态（v0）

```text
+--------------------------------------------------------------+
| ChatTopBar                                                   |
+--------------------------------------------------------------+
| [ READY ] Implement run ticker                    VERIFY     |
+--------------------------------------------------------------+
| MessageList ...                                               |
```

## Step 2 UI 形态（v1 island）

```text
+--------------------------------------------------------------+
| ChatTopBar                                      ╭──────────╮ |
|                                                 │    ✓     │ |
+--------------------------------------------------------------+
| ChatTopBar                            ╭────────────────────╮ |
|                                       │ ● Need permission  │ |
|                                       ╰────────────────────╯ |
+--------------------------------------------------------------+
| MessageList ...                                               |
```

- `RunTicker` 已从普通内容流条目改成顶部居中的 sticky island 浮层
- 视觉语言对齐 `ChatInputBox`：毛玻璃、细边框、柔和阴影、圆角胶囊
- 当前为了尽快给用户可见完成反馈，`ready` 与 `completed` 都会折叠成 `✓`
- 等 Step 7 completion gate 落地后，再把折叠语义收窄回真正的 `completed`

## Step 3 交付

- 新增 shared contracts：
  - `RunStepRecord`
  - `RunCheckpoint`
- 新增 SQLite 表：
  - `deepchat_run_steps`
  - `deepchat_run_checkpoints`
- 新增 main stores：
  - `src/main/presenter/agentRuntimePresenter/runStepStore.ts`
  - `src/main/presenter/agentRuntimePresenter/runCheckpointStore.ts`
- `RunSnapshotBuilder` 现在会从 unresolved wait step + active checkpoint 推导：
  - `blockerSummary`
  - `activeCheckpointLabel`
- permission wait 路径现在具备 durable truth：
  - permission 请求命中时写入 `wait` step
  - 同时写入 `before_wait` checkpoint
  - run 进入 `waiting_permission`
  - grant / deny 时关闭 pending wait step，并写入 `decision` step
  - run 在恢复阶段进入 `recovering`，恢复后回到 `executing` / `ready` / `failed`

## Step 3 UI 形态（v0）

```text
+--------------------------------------------------------------+
| [ WAITING_PERMISSION ] Need permission to write package.json |
+--------------------------------------------------------------+
| MessageList ...                                               |
```

## Step 4 交付

- 扩展 shared contracts：
  - `RunStepKind` 新增 `tool_call`、`tool_result`、`failure`、`aborted`
- `AgentRuntimePresenter` 新增 structured step helpers：
  - `recordToolCallStep()`
  - `recordToolResultStep()`
  - `recordFailureStep()`
  - `recordAbortedStep()`
- `runStreamForMessage()` 现在会在真实工具执行链路上写 durable step log：
  - tool 开始执行时写 `tool_call`
  - tool 成功返回时写 `tool_result`
  - tool 失败时写 failed `tool_result`
- `payloadJson` 现在统一包含最小结构化字段：
  - `effectClass`
  - `evidence`
  - `toolName`
  - `toolArgs`
  - `responsePreview` / `responseLength`（在 `tool_result` 中）
- `dispatch.ts` 现在会推导 v1 `effectClass`：
  - `read`
  - `write`
  - `command`
  - `other`
- 成功的只读型工具结果现在会标记 `evidence=true`
- 终止态现在具备 durable step log：
  - `MAX_TOOL_CALLS` 会写 `failure`，并返回显式 error
  - provider/runtime error 会写 `failure`
  - manual cancel / aborted resume 会写 `aborted`

## Step 4 UI / 验证意义

- 顶部 island ticker 现在不只是“视觉上像状态条”，其摘要背后开始有结构化 step truth 可依赖
- 当前 renderer 还没有消费完整 step timeline，但 main 侧已经具备可扩展的数据骨架
- 这一步完成后，后续 `Run` tab / recovery / completion gate 不需要再从 message block 反推“到底做过什么”

## Step 5 交付

- 新增 `src/main/presenter/agentRuntimePresenter/handoffBuilder.ts`
- `applyCompactionIntent()` 现在会在真正进入 compaction 前生成 `before_compaction` checkpoint
- `retryMessage()` 现在会在删尾并 fresh restart 前生成 `before_reset` checkpoint
- `failure` 路径现在除了写 failure step，还会同时生成 `failure` checkpoint
- checkpoint payload 中开始携带最小 handoff markdown，供后续 recovery / reset 链路读取
- `resumeAssistantMessage()` 现在会把 active checkpoint 里的 handoff markdown 注入 resume system prompt，作为第一条实际消费 handoff 的 recovery 路径
- `processMessage()` 现在会在 compaction 后把 active checkpoint 的 handoff markdown 注入下一轮 prompt
- `retryMessage()` 触发的 reset 路径现在也会消费 `before_reset` checkpoint handoff，而不是只靠 transcript 回放
- 本步刻意不实现 completion checkpoint：
  - 它与 Step 7 的 completion gate 强绑定
  - 提前落地只会制造“ready 冒充 completed”的伪真相

## 验证记录

- `pnpm exec vitest --run test/main/presenter/agentRuntimePresenter/runStore.test.ts test/main/presenter/sqlitePresenter.test.ts test/main/presenter/agentRuntimePresenter/agentRuntimePresenter.test.ts test/main/presenter/remoteControlPresenter/remoteConversationRunner.test.ts`
  - 结果：`3 passed | 1 skipped`
  - 说明：`sqlitePresenter.test.ts` 在当前环境因 sqlite native 依赖不可用被整组跳过；新增 migration/CRUD 用例已写入，需在具备 sqlite 依赖的环境复跑
- `pnpm exec tsc -p tsconfig.json --noEmit`
  - 结果：通过
- `pnpm run format`
  - 结果：通过
- `pnpm run i18n`
  - 结果：通过
- `pnpm run lint`
  - 结果：通过
  - 备注：存在仓库既有 warning 6 条，均与本次改动无关
- `pnpm run typecheck`
  - 结果：通过

- `pnpm exec vitest --run test/main/presenter/agentRuntimePresenter/runStore.test.ts test/main/presenter/sqlitePresenter.test.ts test/main/presenter/agentRuntimePresenter/agentRuntimePresenter.test.ts test/main/presenter/agentSessionPresenter/agentSessionPresenter.test.ts test/main/presenter/agentSessionPresenter/integration.test.ts test/renderer/components/ChatPage.test.ts`
  - 结果：`5 passed | 1 skipped`
  - 说明：`sqlitePresenter.test.ts` 仍因当前环境 sqlite native 依赖不可用被跳过；其余 Step 2 main / renderer 链路已通过
- `pnpm exec vitest --run test/main/presenter/agentRuntimePresenter/agentRuntimePresenter.test.ts test/main/presenter/agentSessionPresenter/integration.test.ts test/main/presenter/sqlitePresenter.test.ts`
  - 结果：`2 passed | 1 skipped`
  - 说明：Step 3 的 permission wait / resume durable truth 已通过 main 定向测试；`sqlitePresenter.test.ts` 仍因当前环境 sqlite native 依赖不可用被跳过
- `pnpm exec vitest --run test/renderer/components/RunTicker.test.ts test/renderer/components/ChatPage.test.ts`
  - 结果：`2 passed`
  - 说明：island ticker 的 compact / active 两态、`ChatPage` 顶部 sticky overlay 接线都已通过 renderer 定向测试
- `pnpm exec vitest --run test/main/presenter/agentRuntimePresenter/process.test.ts test/main/presenter/agentRuntimePresenter/dispatch.test.ts test/main/presenter/agentRuntimePresenter/agentRuntimePresenter.test.ts test/renderer/components/RunTicker.test.ts test/renderer/components/ChatPage.test.ts`
  - 结果：`5 passed`
  - 说明：Step 4 的 structured step log、`MAX_TOOL_CALLS` failure、tool hook metadata、island ticker UI 全部已通过定向测试
- `pnpm exec vitest --run test/main/presenter/agentRuntimePresenter/agentRuntimePresenter.test.ts`
  - 结果：`1 passed`
  - 说明：Step 5 当前子切片的 `before_compaction` / `failure` checkpoint producer 已通过 main 定向测试
- `pnpm exec vitest --run test/main/presenter/agentRuntimePresenter/agentRuntimePresenter.test.ts`
  - 结果：`1 passed`
  - 说明：Step 5 收尾后，`before_reset` checkpoint、compaction handoff 注入、retry reset handoff 注入都已通过 main 定向测试
- `pnpm run format`
  - 结果：通过
- `pnpm run i18n`
  - 结果：通过
- `pnpm run lint`
  - 结果：通过
  - 备注：仍存在仓库既有 warning 6 条，无新增 error
- `pnpm run typecheck`
  - 结果：通过

## 下一步

继续 Step 6

- 开始 `Memory Fabric` 最小闭环
- 优先落 `deepchat_memory_records`、`MemoryStore`、`MemoryManager`
- 让 working set 开始摆脱“只靠 transcript replay”
