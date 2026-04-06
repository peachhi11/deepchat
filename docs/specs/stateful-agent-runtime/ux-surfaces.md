# UX Surfaces

## 目的

本文件定义 stateful runtime 在 renderer 中的主要展示面，目标不是做一个更复杂的聊天界面，而是让“状态、阻塞、恢复、完成”有清晰但克制的可见性。

本文件只定义状态 UI，不重新定义聊天、artifact、browser 的主流程。

## 设计目标

### 1. 状态可见，但不打断聊天

用户应随时知道系统在做什么，但状态 UI 不能膨胀成一个常驻控制台。

### 2. 轻量摘要与完整详情分层

状态面需要分成两层：

1. 顶部轻量摘要：`Run Ticker`
2. 右侧完整详情：`Run` tab

### 3. 视觉语言复用当前系统

必须遵循当前已经形成的 UI 方向：

1. 轻毛玻璃
2. 细边框
3. 圆角胶囊
4. 浅悬浮感

不应引入一套全新的大屏监控式界面。

## 总体结构

推荐结构：

```text
+------------------------------------------------------------------------------+
| ChatTopBar                                                                   |
+------------------------------------------------------------------------------+
|                         [ Run Ticker / Frosted Pill ]                        |
+------------------------------------------------------------------------------+
| message list                                                                 |
| ...                                                                          |
| ...                                                                          |
+--------------------------------------------------------------+---------------+
| input + status bar                                           | Run | Workspace|
|                                                              | Browser       |
|                                                              +---------------+
|                                                              | detail panel  |
+--------------------------------------------------------------+---------------+
```

## Surface 1: `Run Ticker`

## 1. 位置

### 推荐挂点

`ChatPage.vue` 中，`ChatTopBar` 下方、消息列表上方，以 sticky overlay 的方式插入。

### 为什么不直接塞进 `ChatTopBar`

因为 `ChatTopBar` 当前已经承担：

1. title
2. project crumb
3. workspace button
4. share
5. more

并且还有 `window-drag-region` 约束。把复杂状态交互塞进去会：

1. 挤占标题空间
2. 破坏 drag/no-drag 边界
3. 让信息优先级失衡

## 2. 形态

`Run Ticker` 应为单行毛玻璃胶囊条。

建议尺寸：

1. 宽度：`280px - 360px`
2. 高度：`28px - 32px`
3. 最大化保持一行

视觉示意：

```text
                ╭──────────────────────────────────────╮
                │ ● executing  Task 2/5 · cp_007 · ... │
                ╰──────────────────────────────────────╯
```

### 胶囊条，而不是卡片

原则：

1. 更薄
2. 更窄
3. 更圆
4. 不引入明显标题/分组结构

这样更像状态入口，而不是第二个面板。

## 3. 内容结构

不建议整条一起滚动。建议三段结构：

1. 左侧固定：状态
2. 中间滚动：摘要
3. 右侧固定：展开 affordance

示意：

```text
[ ● executing ]  Design retrieval policy · Task 2/5 · cp_007 · no blocker  [>]
```

### 左侧固定状态

展示：

1. 状态点 / 小图标
2. 精简状态标签

例如：

1. `● executing`
2. `● planning`
3. `● blocked`
4. `● waiting`
5. `● recovering`

### 中间滚动摘要

显示优先级建议：

1. current task
2. progress
3. checkpoint
4. blocker / recovery hint

例如：

1. `Design retrieval policy · Task 2/5 · cp_007`
2. `Waiting permission · write package.json`
3. `Recovery suggested · reset + handoff`
4. `Evaluating completion · tests running`

### 右侧 affordance

右侧只保留轻量打开感知，例如：

1. `>`
2. chevron
3. subtle hover glow

不要在 ticker 上放多个按钮。

## 4. 滚动规则

`Run Ticker` 不是新闻跑马灯。推荐“慢速 ticker”：

### 正常执行

1. 中间摘要缓慢滚动
2. 滚动足够慢，保证可读
3. 只滚动中段，不滚动状态和入口

### Hover

1. 暂停滚动
2. 增强边框或背景对比，提示可点击

### Blocked / Waiting / Failed

1. 不滚动
2. 把最重要的阻塞信息钉住
3. 优先让用户读清楚，而不是看动效

## 5. 完成态 `✓`

这是当前已确认的关键交互。

### 行为

1. run 进入 `completed`
2. `Run Ticker` 收起成轻量 `✓`
3. 用户点击 `✓`
   - 打开右侧 `Run` tab
   - 标记这次完成态已读
   - `✓` 消失

### 为什么不是直接消失

因为用户仍需要一个“任务已经完成”的轻量 acknowledgment。

如果直接消失，会让完成态缺少明确收尾反馈。

### 为什么不是一直保留 completed 文本

因为那会长期占用顶部空间，造成页面噪音。

### 交互示意

```text
Running
[ ● executing · Task 4/5 · cp_007 · verifying ]

Completed
[ ✓ ]

Click ✓
-> open Right Sidepanel `Run`
-> acknowledge completion
-> ✓ disappears
```

## 6. 显示策略

### 显示完整 ticker

以下状态显示完整 ticker：

1. `planning`
2. `ready`
3. `executing`
4. `waiting_permission`
5. `waiting_external`
6. `evaluating`
7. `recovering`
8. `failed`

### 隐藏

以下情况默认隐藏：

1. 没有 active run
2. run `draft`
3. run `aborted`
4. completed 且已经 read-acknowledged

### 收起为 `✓`

以下情况收起：

1. `completed` 且尚未 acknowledged

## Surface 2: Right Sidepanel `Run / Workspace / Browser`

## 1. 原则

`Run` 必须是独立一级 tab，不能混进 `Workspace`。

原因：

1. `Run` 是控制面
2. `Workspace` 是文件与产物面
3. `Browser` 是环境面

三者语义不同。

## 2. Tab 结构

推荐：

```text
| Run | Workspace | Browser |
```

### `Run`

展示：

1. goal
2. status / stage
3. progress
4. current task
5. task list
6. checkpoint
7. blocker
8. recent events
9. recovery actions

### `Workspace`

继续承担：

1. artifacts
2. files
3. git

### `Browser`

继续承担嵌入 browser。

## 3. `Run` tab 内容

建议首轮布局：

```text
+-------------------------------- Right Sidepanel -------------------------------+
| Run | Workspace | Browser                                                     |
+--------------------------------------------------------------------------------+
| Goal: Refactor DeepChat memory system                                         |
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
| Recent events                                                                 |
| tool_result -> state_commit -> checkpoint                                     |
|                                                                               |
| Recovery                                                                      |
| [Resume] [Rollback] [Branch] [Reset] [Safe Mode]                              |
+--------------------------------------------------------------------------------+
```

## 4. `Run` tab 中的层次

### 顶部摘要区

显示：

1. Goal
2. Status
3. Stage
4. Progress
5. Current task

### 任务区

显示：

1. 已完成
2. 正在进行
3. 阻塞
4. 未开始

### 轨迹区

显示最近关键 step / trace，而不是完整 debug log。

### 恢复区

显示：

1. 推荐恢复动作
2. 可执行恢复动作

## 5. 打开逻辑

以下交互应直接打开 `Run` tab：

1. 点击 `Run Ticker`
2. 点击完成态 `✓`
3. 未来从 floating widget 点击某个阻塞 run

以下场景可以自动切到 `Run` tab：

1. run 进入 `waiting_permission`
2. run 进入 `failed`
3. run 进入 `recovering` 且系统给出推荐动作

但不应在普通 executing 过程中频繁强制切面板。

## Surface 3: Workspace tab

本次 redesign 不重做 `Workspace`，但需要保证与 `Run` 分工清晰：

### `Workspace` 不应该承担

1. run state 真相
2. checkpoint 列表
3. recovery actions
4. task graph

### `Workspace` 继续承担

1. artifact 查看
2. file tree
3. git diff

## Surface 4: Floating widget

首轮不必完整重做，但需要与 `Run` 体系兼容。

推荐定位：

1. 桌面外部只展示粗粒度活跃 run 信息
2. 点击仍然回到主窗口和目标 session
3. 详细信息永远在 `Run` tab 查看

这样可以避免：

1. 状态展示重复
2. 两套交互分叉

## 状态到 UI 的映射

| RunStatus | Ticker | Run tab | 自动行为 |
| --- | --- | --- | --- |
| `planning` | 显示摘要 | 可见 | 不自动打开 |
| `ready` | 显示摘要 | 可见 | 不自动打开 |
| `executing` | 显示摘要 | 可见 | 不自动打开 |
| `waiting_permission` | 固定阻塞信息 | 可见 | 可选自动切 `Run` |
| `waiting_external` | 固定等待信息 | 可见 | 不自动打开 |
| `recovering` | 显示恢复信息 | 可见 | 可选自动切 `Run` |
| `evaluating` | 显示验证信息 | 可见 | 不自动打开 |
| `completed` | 收起为 `✓` | 可见 | 点击后 `✓` 消失 |
| `failed` | 固定失败信息 | 可见 | 建议自动切 `Run` |
| `aborted` | 默认隐藏 | 可见历史 | 无 |

## UI 数据源

## 1. `Run Ticker` 数据源

`Run Ticker` 应读取 `RunSnapshot`，而不是直接读取 message list。

建议字段：

1. `status`
2. `stage`
3. `progressDone`
4. `progressTotal`
5. `currentTaskTitle`
6. `activeCheckpointLabel`
7. `blockerSummary`
8. `tickerSummary`
9. `completionAcknowledged`

## 2. `Run` tab 数据源

建议组合：

1. `RunSnapshot`
2. `TaskNode[]`
3. `RunCheckpoint[]`
4. `RunTraceEvent[]`
5. recovery recommendations

## 文案建议

UI 不建议直接暴露“State Plane / Memory Plane / Eval Plane”等术语。

建议对用户使用：

1. `Run`
2. `Task`
3. `Blocked`
4. `Checkpoint`
5. `Recovery`
6. `Completed`

这样更贴近任务执行语义。

## 非目标

1. 不把顶部 ticker 做成多行状态台。
2. 不把 `Run` tab 做成复杂调试控制台。
3. 不在首轮把 memory 直接全暴露给用户浏览。
4. 不让 `Workspace` 重新承担状态真相。

## 本文件结论

正确的状态 UI 应该遵守：

1. 顶部一行，告诉你“现在在做什么”
2. 右侧一栏，告诉你“为什么这样、接下来怎么办”
3. 完成后一个 `✓`，告诉你“这次结束了”

这三层足够支撑 state-first runtime，又不会把聊天主体验做得臃肿。
