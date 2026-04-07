# Stateful Agent Runtime 实施进度

最后更新：2026-04-07

## 当前状态

| Step | 状态 | 结论 |
| --- | --- | --- |
| Step 1: Minimal Run Truth | 已完成 | 已补 shared run contracts、`deepchat_runs` durable schema、`DeepChatRunStore`，并把 runtime 内部的 ephemeral `runId` 去歧义为 `generationId`。 |
| Step 2: Active Run Lifecycle | 已完成 | 已补 `RunStateManager`、`RunSnapshotBuilder`、`getActiveRunSnapshot()` 与 `RUN_SNAPSHOT_UPDATED`，regular DeepChat session 现在会生成 durable active run snapshot。 |
| Step 3: Permission Wait Backbone | 已完成 | 已补 `deepchat_run_steps`、`deepchat_run_checkpoints`、permission wait checkpoint / step / decision durable truth，并把 grant / deny / resume 接回 run snapshot。 |
| Step 4: Structured Step Log | 未开始 | 下一步把 `tool_call` / `tool_result` / `failure` 等统一沉淀成结构化 step log。 |

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

Step 4: Structured Step Log

- 把 `tool_call` / `tool_result` / `decision` / `failure` 统一落成 `StepRecord`
- 为 `MAX_TOOL_CALLS`、abort、provider error 建立结构化 failure 记录
- 让 “这次 run 做了什么、卡在哪里、为什么结束” 不再依赖 message block 逆向推断
