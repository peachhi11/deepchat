# Stateful Agent Runtime / Harness Redesign

本专题目录用于定义 DeepChat 从“run-capable chat runtime”演进到“stateful task runtime”的完整规格集合。

## 阅读顺序

如果你第一次进入这个专题，建议按以下顺序阅读：

1. [`spec.md`](./spec.md)
   - 定义目标、边界、原则、验收标准
2. [`plan.md`](./plan.md)
   - 定义实现架构、数据模型、接入点、分阶段计划
3. [`current-state-audit.md`](./current-state-audit.md)
   - 审视当前 DeepChat runtime 的真实结构、状态分布与缺口
4. [`state-kernel.md`](./state-kernel.md)
   - 定义 `Run / Task / Step / Checkpoint` 以及状态机
5. [`memory-fabric.md`](./memory-fabric.md)
   - 定义 memory scope、写入策略、检索策略与 working set 组装
6. [`ux-surfaces.md`](./ux-surfaces.md)
   - 定义 `Run Ticker`、`Run` tab、sidepanel 交互与完成态 `✓`
7. [`observability-and-recovery.md`](./observability-and-recovery.md)
   - 定义 trace、metrics、constraint、recovery、eval 对接面
8. [`delivery-slices.md`](./delivery-slices.md)
   - 定义推荐切片、PR 顺序、风险控制与里程碑
9. [`tasks.md`](./tasks.md)
   - 定义任务清单与执行顺序
10. [`progress.md`](./progress.md)
   - 记录当前实际实施进度、验证结果与下一步

## 文档分工

### 总文档

- [`spec.md`](./spec.md)
  - 负责回答：为什么要做、做什么、不做什么、做到什么程度算完成
- [`plan.md`](./plan.md)
  - 负责回答：系统怎么接、数据怎么存、模块怎么落
- [`tasks.md`](./tasks.md)
  - 负责回答：按什么顺序推进、每一步交付什么
- [`progress.md`](./progress.md)
  - 负责回答：现在做到哪一步、验证是否通过、下一步是什么

### 拆分文档

- [`current-state-audit.md`](./current-state-audit.md)
  - 当前架构与缺口盘点
- [`state-kernel.md`](./state-kernel.md)
  - 状态真相与 run-level state machine
- [`memory-fabric.md`](./memory-fabric.md)
  - 记忆与 handoff 的设计中心
- [`ux-surfaces.md`](./ux-surfaces.md)
  - 用户能看到和操作到的状态展示面
- [`observability-and-recovery.md`](./observability-and-recovery.md)
  - 反馈系统、恢复系统、后续 eval 入口
- [`delivery-slices.md`](./delivery-slices.md)
  - 实施切片与阶段性 Definition of Done

## 推荐落地顺序

如果只看工程执行顺序，推荐直接按下面的路径推进：

1. `current-state-audit.md`
2. `state-kernel.md`
3. `memory-fabric.md`
4. `ux-surfaces.md`
5. `delivery-slices.md`
6. `tasks.md`

## 当前共识摘要

当前已对齐的关键结论：

1. DeepChat 当前瓶颈不在 execution plane，而在 state 与 memory 没有成为系统级能力。
2. 这次 redesign 应该是 `state-first`，不是 `eval-first`、也不是 `tool-first`。
3. 顶部状态入口采用单行毛玻璃 `Run Ticker`，而不是扩张现有 `ChatTopBar`。
4. 右侧 sidepanel 采用三个一级 tab：`Run / Workspace / Browser`。
5. `Run Ticker` 在 run `completed` 后收起成 `✓`，点击后打开 `Run` tab 并消失。

## 与现有架构文档的关系

本专题不替代以下现有文档，而是建立在它们之上：

1. [`docs/architecture/agent-system.md`](../../architecture/agent-system.md)
2. [`docs/architecture/session-management.md`](../../architecture/session-management.md)
3. [`docs/architecture/tool-system.md`](../../architecture/tool-system.md)
4. [`docs/spec-driven-dev.md`](../../spec-driven-dev.md)

这些文档定义当前系统；本专题定义下一代 stateful runtime 应该如何从当前系统演进而来。
