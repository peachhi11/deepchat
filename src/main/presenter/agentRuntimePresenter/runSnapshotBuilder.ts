import type { HarnessRun, RunSnapshot, RunStatus } from '@shared/types/agent-interface'
import type { DeepChatRunCheckpointStore } from './runCheckpointStore'
import type { DeepChatRunStepStore } from './runStepStore'

const FALLBACK_SUMMARY_BY_STATUS: Record<RunStatus, string> = {
  draft: 'Draft run',
  planning: 'Preparing the current turn',
  ready: 'Ready for the next turn',
  executing: 'Working on the current turn',
  waiting_permission: 'Waiting for permission',
  waiting_external: 'Waiting for an external response',
  evaluating: 'Evaluating the current result',
  recovering: 'Recovering the current run',
  completed: 'Run completed',
  failed: 'Run failed',
  aborted: 'Run aborted'
}

const normalizeSummary = (value: string | null | undefined): string => {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? ''
  return normalized
}

const clampSummary = (value: string, maxLength: number = 160): string => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

export class RunSnapshotBuilder {
  private readonly runStepStore?: DeepChatRunStepStore
  private readonly runCheckpointStore?: DeepChatRunCheckpointStore

  constructor(options?: {
    runStepStore?: DeepChatRunStepStore
    runCheckpointStore?: DeepChatRunCheckpointStore
  }) {
    this.runStepStore = options?.runStepStore
    this.runCheckpointStore = options?.runCheckpointStore
  }

  build(run: HarnessRun | null): RunSnapshot | null {
    if (!run) {
      return null
    }

    const waitStep = this.runStepStore?.getLatestPendingWaitStep(run.id) ?? null
    const checkpoint =
      run.activeCheckpointId && this.runCheckpointStore
        ? this.runCheckpointStore.get(run.activeCheckpointId)
        : null
    const summarySource =
      normalizeSummary(run.goal) ||
      normalizeSummary(run.title) ||
      FALLBACK_SUMMARY_BY_STATUS[run.status]

    return {
      runId: run.id,
      sessionId: run.sessionId,
      title: run.title,
      goal: run.goal,
      status: run.status,
      stage: run.stage,
      progressDone: 0,
      progressTotal: 0,
      currentTaskId: run.currentTaskId ?? null,
      currentTaskTitle: null,
      activeCheckpointId: run.activeCheckpointId ?? null,
      activeCheckpointLabel: checkpoint?.label ?? null,
      blockerSummary: waitStep?.title ?? null,
      tickerSummary: clampSummary(summarySource),
      completionAcknowledged: false,
      updatedAt: run.updatedAt
    }
  }
}
