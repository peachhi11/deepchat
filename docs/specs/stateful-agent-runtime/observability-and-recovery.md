# Observability And Recovery

## 目的

本文件定义：

1. DeepChat 在 stateful runtime 下应如何记录过程
2. 应优先观察哪些指标
3. recovery 应如何被标准化
4. eval 应建立在哪些结构化输入之上

它是 `State Kernel` 与 `Memory Fabric` 之后的第三层能力。

## 设计立场

### 1. 观测必须读 state，不猜 transcript

如果 observability 仍依赖字符串匹配 message history，那么：

1. compaction 后容易失真
2. recovery 后容易断链
3. eval 难以稳定

因此观测的 primary input 应为：

1. `Run`
2. `TaskNode`
3. `StepRecord`
4. `Checkpoint`
5. `MemoryRecord`
6. `RunTraceEvent`

### 2. 恢复必须是固定动作，不是自由文本建议

系统不应该只说“建议重新开始”或“建议重试一下”。

应标准化为有限的 recovery actions。

### 3. Eval 先建立数据地基，再建立面板

没有稳定的 trace / checkpoint / outcome，就不应先做花哨 eval dashboard。

## Trace 模型

## 1. 为什么要单独 trace

`StepRecord` 是执行记录，但仍偏结果摘要。

trace 的职责是保留更细粒度的结构化事件，尤其适用于：

1. 复盘状态迁移
2. 统计工具调用模式
3. 分析重复失败
4. 为 eval 提供可筛选过程片段

## 2. 建议结构

```ts
type RunTraceEvent = {
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

## 3. 最小必须记录的事件

### `state_transition`

记录：

1. from status/stage
2. to status/stage
3. reason

### `tool_call`

记录：

1. tool name
2. task id
3. whether pre-check required permission

### `tool_result`

记录：

1. success / error
2. truncated summary
3. evidence refs

### `memory_write`

记录：

1. memory scope
2. kind
3. confidence

### `checkpoint`

记录：

1. checkpoint kind
2. checkpoint id
3. handoff ref

### `eval`

记录：

1. verify type
2. pass / fail
3. failed criteria

## Metrics baseline

首轮不需要太多指标，但必须优先观察那些直接反映“任务执行是否可靠”的指标。

## 1. `resume_success_rate`

定义：

1. 进入 waiting / recovering 后，成功回到 `executing` 并继续推进的比例

意义：

1. 判断 checkpoint + recovery 是否真的可用

## 2. `false_done_rate`

定义：

1. run 进入 `evaluating` 后未通过 verify、任务被 reopen 的比例

意义：

1. 判断 completion gate 是否有效

## 3. `repeated_tool_call_rate`

定义：

1. 同一任务在短时间内重复触发同类工具调用的比例

意义：

1. 判断系统是否发生上下文漂移或恢复失真

## 4. `blocked_by_permission_time`

定义：

1. run 处于 `waiting_permission` 的总时长

意义：

1. 判断阻塞成本
2. 判断 UX 是否需要优化

## 5. `checkpoint_coverage`

定义：

1. 应建立 checkpoint 的关键边界中，实际建立 checkpoint 的覆盖率

意义：

1. 判断恢复能力是否真的落地

## 6. `task_reopen_rate`

定义：

1. 已完成 task 因 verify / evidence 不足重新打开的比例

意义：

1. 判断任务完成定义是否足够稳

## 7. `memory_hit_rate`

定义：

1. working set 中实际引用到 memory record 的比例

意义：

1. 判断 memory fabric 是否真的在服务执行

## Recovery 模型

## 1. 固定 recovery actions

建议标准化为五类动作：

### `Resume`

从当前 checkpoint 继续。

适用：

1. 已有充分状态
2. blocker 已解除

### `Rollback`

回退到上一个稳定 checkpoint。

适用：

1. 当前 step 污染较大
2. 当前恢复路径不可信

### `Branch`

从某个 checkpoint 分叉一条新 run。

适用：

1. 需要尝试替代路径
2. 不希望污染原 run

### `Reset + Handoff`

清空运行时上下文，基于 handoff 在新鲜上下文重启执行。

适用：

1. context drift
2. compaction 已无法维持稳定性
3. repeated tool loops without progress

### `Safe Mode`

禁止写操作，只做检查、诊断、验证。

适用：

1. 用户需要先看清现场
2. 连续恢复失败

## 2. Recovery suggestion 如何生成

建议基于以下输入：

1. 当前 run status
2. 当前 blocker
3. recent failed steps
4. repeated tool call pattern
5. latest checkpoint availability

### 示例

#### 情况 A：仅等待权限

建议：

1. `Resume`

#### 情况 B：重复工具调用但无状态推进

建议：

1. `Reset + Handoff`

#### 情况 C：刚发生 risky tool 失败且前一个 checkpoint 完整

建议：

1. `Rollback`
2. 或 `Branch`

## Constraint layering

recovery 与 observability 要成立，constraint 也要有层级。

## 1. Capability constraints

例如：

1. 哪些工具可用
2. 哪些目录可写
3. 哪些网络域名允许访问

## 2. Process constraints

例如：

1. 没有 taskId 不允许 destructive action
2. 没有 evidence 不允许写高置信 semantic memory
3. 没有 checkpoint 不允许 reset

## 3. Budget constraints

例如：

1. token budget
2. tool-call budget
3. maximum retry count

## 4. Quality constraints

例如：

1. 未通过 verify 不可 completed
2. 无 handoff 不可 reset
3. blocker 未清除不可 resume

这些 constraint 首轮不一定全部执行自动 gating，但必须在设计中预留。

## Eval 对接

## 1. Eval 读取什么

后续 grader 不应直接读取完整 transcript。建议读取：

1. run outcome
2. task graph
3. selected trace events
4. checkpoints
5. artifact set
6. acceptance criteria
7. environment diff / test result

## 2. Eval 分层

### Outcome grader

看最终是否达成目标。

### Artifact grader

看交付物是否完整。

### Trace grader

只在效率、安全、合规等维度读过程。

### Consistency runner

对同类任务多次 trial 看稳定性。

## 3. 为什么 eval 必须放后面

因为没有：

1. state truth
2. checkpoints
3. task graph
4. stable trace

eval 就会退化成“看聊天记录像不像做完了”，价值有限。

## 首轮必须做到什么

首轮 observability / recovery baseline 建议只要求：

1. 能记录最小 trace
2. 能展示 run timeline
3. 能提供固定 recovery action
4. 能给出简单 recovery suggestion

先不要追求：

1. 复杂 dashboard
2. 自适应 policy engine
3. 大规模自动评测平台

## 本文件结论

Observability / Recovery 的核心不是多炫的面板，而是：

1. 系统是否留下了足够好的结构化轨迹
2. 系统是否真的知道如何回来

如果 state kernel 和 memory fabric 是内核，那么 observability 与 recovery 就是这套内核的反馈与可靠性外壳。
