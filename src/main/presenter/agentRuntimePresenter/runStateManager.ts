import type { HarnessRun, RunStage, RunStatus } from '@shared/types/agent-interface'
import { DeepChatRunStore } from './runStore'

const TERMINAL_RUN_STATUSES = new Set<RunStatus>(['completed', 'failed', 'aborted'])

const normalizeRunText = (value: string | null | undefined, fallback: string): string => {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? ''
  return normalized || fallback
}

type EnsureActiveRunInput = {
  sessionId: string
  title: string
  goal: string
}

type RunUpdateInput = {
  status: RunStatus
  stage?: RunStage
  title?: string
  goal?: string
  activeCheckpointId?: string | null
  triggerMessageId?: string | null
  startedAt?: number | null
  completedAt?: number | null
}

export class RunStateManager {
  private readonly runStore: DeepChatRunStore
  private nextRunSequence = 0

  constructor(runStore: DeepChatRunStore) {
    this.runStore = runStore
  }

  getLatestRun(sessionId: string): HarnessRun | null {
    return this.runStore.getLatestBySession(sessionId)
  }

  ensureActiveRun(input: EnsureActiveRunInput): HarnessRun {
    const now = Date.now()
    const title = normalizeRunText(input.title, 'Current turn')
    const goal = normalizeRunText(input.goal, title)
    const latestRun = this.runStore.getLatestBySession(input.sessionId)

    if (latestRun && !TERMINAL_RUN_STATUSES.has(latestRun.status)) {
      return this.requireRun(
        this.updateRun(latestRun.id, {
          status: 'planning',
          stage: 'intent',
          title,
          goal,
          startedAt: latestRun.startedAt ?? now,
          completedAt: null
        })
      )
    }

    const run: HarnessRun = {
      id: `${input.sessionId}:run:${Date.now()}:${++this.nextRunSequence}`,
      sessionId: input.sessionId,
      title,
      goal,
      status: 'planning',
      stage: 'intent',
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null
    }

    this.runStore.create(run)
    return run
  }

  attachTriggerMessage(runId: string, triggerMessageId: string): HarnessRun | null {
    return this.updateRun(runId, {
      status: 'planning',
      triggerMessageId
    })
  }

  markExecuting(runId: string): HarnessRun | null {
    return this.updateRun(runId, {
      status: 'executing',
      stage: 'task',
      completedAt: null
    })
  }

  markReady(runId: string): HarnessRun | null {
    return this.updateRun(runId, {
      status: 'ready',
      stage: 'verify',
      completedAt: null
    })
  }

  markWaitingPermission(runId: string, checkpointId: string): HarnessRun | null {
    return this.updateRun(runId, {
      status: 'waiting_permission',
      stage: 'task',
      activeCheckpointId: checkpointId,
      completedAt: null
    })
  }

  markRecovering(runId: string): HarnessRun | null {
    return this.updateRun(runId, {
      status: 'recovering',
      stage: 'handoff',
      completedAt: null
    })
  }

  markFailed(runId: string): HarnessRun | null {
    return this.updateRun(runId, {
      status: 'failed',
      completedAt: Date.now()
    })
  }

  markAborted(runId: string): HarnessRun | null {
    return this.updateRun(runId, {
      status: 'aborted',
      completedAt: Date.now()
    })
  }

  clearSession(sessionId: string): void {
    this.runStore.deleteBySession(sessionId)
  }

  private updateRun(runId: string, updates: RunUpdateInput): HarnessRun | null {
    const existing = this.runStore.get(runId)
    if (!existing) {
      return null
    }

    this.runStore.update(runId, {
      status: updates.status,
      stage: updates.stage ?? existing.stage,
      title: updates.title ?? existing.title,
      goal: updates.goal ?? existing.goal,
      activeCheckpointId:
        updates.activeCheckpointId === undefined
          ? existing.activeCheckpointId
          : updates.activeCheckpointId,
      triggerMessageId:
        updates.triggerMessageId === undefined
          ? existing.triggerMessageId
          : updates.triggerMessageId,
      startedAt: updates.startedAt === undefined ? existing.startedAt : updates.startedAt,
      completedAt: updates.completedAt === undefined ? existing.completedAt : updates.completedAt,
      updatedAt: Date.now()
    })

    return this.runStore.get(runId)
  }

  private requireRun(run: HarnessRun | null): HarnessRun {
    if (!run) {
      throw new Error('Run state update failed because the target run does not exist.')
    }

    return run
  }
}
