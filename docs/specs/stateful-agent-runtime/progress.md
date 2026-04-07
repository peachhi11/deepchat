# Stateful Agent Runtime 实施进度

最后更新：2026-04-07

## 当前状态

| Step | 状态 | 结论 |
| --- | --- | --- |
| Step 1: Minimal Run Truth | 已完成 | 已补 shared run contracts、`deepchat_runs` durable schema、`DeepChatRunStore`，并把 runtime 内部的 ephemeral `runId` 去歧义为 `generationId`。 |
| Step 2: Active Run Lifecycle | 未开始 | 下一步接 `ensureActiveRun()` 与 active run snapshot 查询。 |

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

## 下一步

Step 2: Active Run Lifecycle

- 新增 `RunStateManager`
- 在 `processMessage()` 前接入 `ensureActiveRun(sessionId, triggerMessageId)`
- 为 `agentSessionPresenter` 暴露 `getActiveRunSnapshot(sessionId)`
- 让 regular DeepChat session 在首条消息后具备可查询的 active run durable truth
