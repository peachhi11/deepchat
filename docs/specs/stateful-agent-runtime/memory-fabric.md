# Memory Fabric

## 目的

本文件定义 DeepChat 的 memory 体系，重点不是“存更多内容”，而是把“该记住什么、该怎么带上、该如何失效、该怎么交接”做成结构化能力。

如果 [`state-kernel.md`](./state-kernel.md) 定义的是“系统现在处于什么状态”，那么 memory fabric 定义的是“系统应该带着什么继续做下去”。

## 核心立场

### 1. Memory 不是 transcript replay

把整段 transcript 再喂回模型，只是上下文回放，不是 memory。

memory 必须满足以下条件：

1. 有 scope
2. 有 provenance
3. 有 confidence
4. 有 freshness
5. 有 supersede 关系

### 2. Memory 必须为执行服务

memory 的首要目标不是“沉淀知识库”，而是：

1. 支撑 working set 构建
2. 支撑 handoff
3. 支撑恢复与验证
4. 降低重复试错

### 3. Memory 必须与 state 联动

检索 memory 时，不能脱离当前 run state。

正确方式是：

```text
run state
  + active task
  + current blocker
  + latest checkpoint
  -> retrieval policy
  -> working set
```

## 五类 memory

## 1. Working Memory

### 定义

当前 step 执行必须携带的最小上下文集合。

### 典型内容

1. 当前 run summary
2. 当前 active task
3. 最近 checkpoint
4. 最近重要 step
5. 必需 artifact refs
6. 当前 blocker
7. 必要 evidence

### 特点

1. 强 state-aware
2. 高时效
3. 可重建
4. 不等于长期保存

### 用途

主要用于：

1. 构建 bounded step prompt
2. reset + handoff 后重建上下文

## 2. Episodic Memory

### 定义

记录“发生过什么”的结构化记忆。

### 典型内容

1. 某个 task 为什么被拆分
2. 某个工具为何失败
3. 某次权限为什么被拒绝
4. 某次恢复为什么触发
5. 某个 verify 为什么失败

### 特点

1. 与时间顺序强相关
2. 可带较低 confidence
3. 强 run / task 关联

## 3. Semantic Memory

### 定义

系统认为相对稳定的事实。

### 典型内容

1. 仓库使用 `pnpm`
2. 某目录是 generated code，不应手改
3. 用户偏好尽量不新增依赖
4. 某 MCP 服务经常超时

### 特点

1. 应有较高 confidence
2. 应有 evidence support
3. 允许被 supersede

### 风险

如果没有证据约束，semantic memory 很容易变成“模型误记”。

因此首轮不应开放过于宽松的 semantic 写入。

## 4. Procedural Memory

### 定义

系统从任务中归纳出的“如何做更稳”的流程性记忆。

### 典型内容

1. 这个项目改动前先跑 `pnpm test`
2. browser 任务在提交前必须截图校验
3. release 前必须先写 changelog draft

### 特点

1. 比 semantic 更偏 workflow
2. 需要多次 evidence 或明确规则支撑
3. 不能因为单次任务就随意固化

## 5. Evidence Memory

### 定义

记忆不是结论，而是支撑结论的证据索引。

### 典型来源

1. 文件路径
2. 测试结果
3. diff
4. screenshot
5. logs
6. tool output
7. trace event
8. webpage / external response refs

### 意义

没有 evidence，memory 就很难做：

1. 升级为 stable fact
2. 被 verifier 复查
3. 在 recovery 中重放

## `MemoryRecord` 结构

建议基础结构：

```ts
type MemoryScope = 'working' | 'episodic' | 'semantic' | 'procedural' | 'evidence'

type MemoryRecord = {
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
```

## 字段解释

### `scope`

决定这条记忆参与哪些 retrieval policy。

### `kind`

帮助下游知道这条 memory 是事实、偏好、失败还是约束。

### `evidenceRefs`

最关键字段之一。没有 evidenceRefs 的 stable memory 应高度受限。

### `confidence`

不是模型自信分，而是系统允许下游怎样使用它的策略信号。

建议首轮约束：

1. `confidence < 0.6`
   - 不允许进入 semantic
2. `confidence >= 0.8`
   - 才允许作为高可信 stable fact 候选

### `freshness`

用于区分：

1. 容易过期的信息
2. 相对稳定的信息

例如：

1. “当前分支有 23 个改动文件”应视作 `volatile`
2. “仓库使用 pnpm workspace”可视作 `stable`

### `supersedes`

memory 更新必须可追踪，不允许无痕替换。

例如：

1. 旧偏好被新偏好覆盖
2. 旧事实被新 evidence 推翻
3. 旧路径信息因迁移失效

## Memory write policy

## 1. 高信号时刻写入

不是每一步都写 memory。首轮建议只在以下事件写入：

1. task 被创建或重新拆分
2. task 完成、失败、reopen、blocked
3. 用户明确表达偏好
4. permission 被拒绝或放行，且对后续任务有重要影响
5. verify / test / screenshot / diff 等 evidence 出现
6. recovery 前 handoff 固化
7. compaction 前摘要固化

## 2. 不应默认写入的内容

以下内容不应自动进入 memory：

1. 任意普通 assistant 文本
2. 冗长推理过程
3. 未经确认的猜测
4. 没有 evidence 的“项目事实”

## 3. Scope gating 规则

### `working`

1. 可以由 retrieval 动态生成
2. 可落临时索引，但不当作长期积累主仓

### `episodic`

1. 默认最宽松
2. 允许中等 confidence
3. 强时间顺序

### `evidence`

1. 接收文件、diff、测试、截图、日志引用
2. 可以不直接喂模型，但必须可被 handoff / verifier 读取

### `semantic`

首轮 gate：

1. 需要 evidence
2. 需要高 confidence
3. 尽量来自重复出现的事实，或明确用户声明

### `procedural`

首轮 gate：

1. 需要多次 evidence 或显式项目规则
2. 不能因为单次偶发经验就写入

## Retrieval policy

## 1. 检索输入

retrieval 不能只有 query 文本。至少应包含：

1. `run.status`
2. `run.stage`
3. `currentTaskId`
4. `currentStepId`
5. `environmentId`
6. current blocker
7. recent failures
8. explicit user goal

## 2. Working set 组装顺序

推荐：

```text
run snapshot
  + active task
  + latest checkpoint
  + latest episodic memory
  + scoped semantic/procedural memory
  + required evidence refs
  = working set
```

### 为什么不用“按 embedding 找最像的历史”

因为当前执行最需要的并不一定是“最相似”的内容，而是：

1. 与当前 task 强相关
2. 与当前 blocker 强相关
3. 与当前 checkpoint 相邻
4. 与当前环境一致

## 3. Scope 优先级

建议默认优先级：

1. `working`
2. `episodic`
3. `evidence`
4. `semantic`
5. `procedural`

只有在需要跨任务稳定事实时，再加大 `semantic/procedural` 权重。

## 4. Evidence 组装策略

evidence 不应全部塞进 prompt，而应使用引用和摘要：

1. 用 summary 提示“有什么证据”
2. 必要时只拉入证据片段
3. 大型文件 / 大 diff / 大 log 仅保留引用路径与关键摘要

## Memory 与 compaction / handoff 的关系

## 1. Compaction 不是 memory 的替代

compaction 负责：

1. 压缩当前 transcript
2. 维持 token budget

memory 负责：

1. 保存结构化事实
2. 保存关键决策
3. 保存 evidence 索引

两者职责不同。

## 2. Handoff 应读取 memory，而不是只读 transcript

handoff builder 建议组合：

1. 当前 run snapshot
2. active task
3. latest checkpoint
4. recent episodic memory
5. must-keep evidence

这样 reset 后不会退化成“只剩自然语言摘要”的 fragile continuation。

## 3. Working set 应优先由 checkpoint + memory 重建

这也是 state-first 的核心收益：

1. 不依赖完整历史上下文仍能继续
2. compaction 更安全
3. long-running task 更稳

## 首轮 implementation boundary

首轮 memory 不应贪大。推荐交付：

### 必做

1. `MemoryRecord` schema
2. `working` retrieval
3. `episodic` write/read
4. `evidence` write/read
5. `confidence` / `freshness` / `supersedes`

### 先建模后严格开放

1. `semantic`
2. `procedural`

这样可以避免早期 memory 质量失控。

## 典型场景

## 场景 1：权限拒绝

发生：

1. tool 请求写文件
2. 用户拒绝

应写入：

1. episodic
   - “User denied write access to `package.json` during dependency change attempt.”
2. evidence
   - permission block / decision step refs

可能影响：

1. working set 下次执行时应带上“不要继续尝试该写操作”的约束

## 场景 2：verify 失败

发生：

1. 模型说 done
2. 测试失败

应写入：

1. episodic
   - “Run entered evaluating but verification failed because tests X/Y failed.”
2. evidence
   - test log refs

可能影响：

1. task reopen
2. working set 带上 failing tests 摘要

## 场景 3：项目稳定事实确认

发生：

1. 多个地方读取到 `pnpm-workspace.yaml`
2. `package.json` scripts 与 lockfile 都支持该结论

可写入：

1. semantic
   - “Repository uses pnpm workspace.”
2. evidence
   - file refs

前提：

1. evidence 充分
2. confidence 足够高

## Safeguards

## 1. 不允许无 evidence 的 stable fact 大量入库

否则 memory 很快会变成幻觉积累器。

## 2. 不允许无限增长的 working set

working set 必须是 bounded 的，不然只是把 transcript replay 换个名字。

## 3. 不允许 semantic/procedural 自动无门槛提升

需要 gate，甚至需要人工/多次 evidence 触发。

## 本文件结论

Memory Fabric 的核心不在于“记得更多”，而在于：

1. 记对
2. 带对
3. 忘对
4. 能交接

只有这样，DeepChat 才能真正解决长任务中的上下文漂移和恢复脆弱问题。
