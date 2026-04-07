import type { HarnessRun, MemoryRecord, RunSnapshot } from '@shared/types/agent-interface'
import type { DeepChatMemoryManager } from './memoryManager'
import type { RunSnapshotBuilder } from './runSnapshotBuilder'

export type WorkingSet = {
  snapshot: RunSnapshot | null
  episodicMemories: MemoryRecord[]
  evidenceMemories: MemoryRecord[]
}

const clampWorkingSummary = (value: string, maxLength = 180): string => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}...`
}

const formatMemoryLine = (record: MemoryRecord): string => {
  const refParts = [
    ...(record.payloadUri ? [`payload=${record.payloadUri}`] : []),
    ...record.evidenceRefs.slice(0, 2)
  ]

  return refParts.length > 0
    ? `- ${record.summary} [${refParts.join(', ')}]`
    : `- ${record.summary}`
}

export class DeepChatRetrievalPlanner {
  private readonly memoryManager: DeepChatMemoryManager
  private readonly runSnapshotBuilder: RunSnapshotBuilder

  constructor(memoryManager: DeepChatMemoryManager, runSnapshotBuilder: RunSnapshotBuilder) {
    this.memoryManager = memoryManager
    this.runSnapshotBuilder = runSnapshotBuilder
  }

  buildWorkingSet(sessionId: string, run: HarnessRun | null): WorkingSet {
    const snapshot = this.runSnapshotBuilder.build(run)
    const records = this.memoryManager.listBySession(sessionId, {
      scopes: ['episodic', 'evidence'],
      limit: 8
    })

    return {
      snapshot,
      episodicMemories: records.filter((record) => record.scope === 'episodic').slice(0, 2),
      evidenceMemories: records.filter((record) => record.scope === 'evidence').slice(0, 3)
    }
  }

  buildPromptSection(workingSet: WorkingSet): string | null {
    const hasMemory =
      workingSet.episodicMemories.length > 0 || workingSet.evidenceMemories.length > 0
    const hasRunSignals = Boolean(
      workingSet.snapshot?.activeCheckpointLabel || workingSet.snapshot?.blockerSummary
    )

    if (!hasMemory && !hasRunSignals) {
      return null
    }

    const lines = [
      '## Working Memory',
      'Use this state-aware working set before relying on transcript replay.'
    ]

    if (workingSet.snapshot) {
      lines.push('', '### Run State')
      lines.push(
        `- Goal: ${clampWorkingSummary(workingSet.snapshot.goal || workingSet.snapshot.title)}`
      )
      lines.push(`- Status: ${workingSet.snapshot.status}`)
      lines.push(`- Stage: ${workingSet.snapshot.stage}`)
      if (workingSet.snapshot.activeCheckpointLabel) {
        lines.push(`- Active checkpoint: ${workingSet.snapshot.activeCheckpointLabel}`)
      }
      if (workingSet.snapshot.blockerSummary) {
        lines.push(`- Blocker: ${clampWorkingSummary(workingSet.snapshot.blockerSummary)}`)
      }
    }

    if (workingSet.episodicMemories.length > 0) {
      lines.push('', '### Recent Episodic Memory')
      for (const record of workingSet.episodicMemories) {
        lines.push(formatMemoryLine(record))
      }
    }

    if (workingSet.evidenceMemories.length > 0) {
      lines.push('', '### Recent Evidence Memory')
      for (const record of workingSet.evidenceMemories) {
        lines.push(formatMemoryLine(record))
      }
    }

    return lines.join('\n')
  }
}
