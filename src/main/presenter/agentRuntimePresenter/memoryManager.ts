import type { MemoryFreshness, MemoryRecord, MemoryScope } from '@shared/types/agent-interface'
import { DeepChatMemoryStore } from './memoryStore'

const truncateMemorySummary = (value: string, maxLength = 240): string => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}...`
}

type CreateMemoryBaseInput = {
  id: string
  sessionId: string
  runId: string
  sourceStepId: string
  scope: MemoryScope
  kind: MemoryRecord['kind']
  summary: string
  payloadUri?: string | null
  evidenceRefs?: string[]
  confidence: number
  freshness: MemoryFreshness
}

export class DeepChatMemoryManager {
  private readonly memoryStore: DeepChatMemoryStore

  constructor(memoryStore: DeepChatMemoryStore) {
    this.memoryStore = memoryStore
  }

  listBySession(
    sessionId: string,
    options?: {
      scopes?: MemoryScope[]
      limit?: number
    }
  ): MemoryRecord[] {
    return this.memoryStore.listBySession(sessionId, options)
  }

  recordToolEvidence(params: {
    sessionId: string
    runId: string
    sourceStepId: string
    toolName: string
    responsePreview: string
    payloadUri?: string | null
  }): void {
    this.createMemoryIfAbsent({
      id: `memory:evidence:${params.sourceStepId}`,
      sessionId: params.sessionId,
      runId: params.runId,
      sourceStepId: params.sourceStepId,
      scope: 'evidence',
      kind: 'artifact',
      summary: truncateMemorySummary(
        `${params.toolName} produced evidence: ${params.responsePreview}`
      ),
      payloadUri: params.payloadUri ?? null,
      evidenceRefs: [`run-step:${params.sourceStepId}`],
      confidence: 0.92,
      freshness: 'volatile'
    })
  }

  recordFailureEpisode(params: {
    sessionId: string
    runId: string
    sourceStepId: string
    errorMessage: string
    stopReason?: string
    checkpointId?: string | null
  }): void {
    this.createMemoryIfAbsent({
      id: `memory:episodic:${params.sourceStepId}`,
      sessionId: params.sessionId,
      runId: params.runId,
      sourceStepId: params.sourceStepId,
      scope: 'episodic',
      kind: 'failure',
      summary: truncateMemorySummary(
        `Run failure (${params.stopReason ?? 'error'}): ${params.errorMessage}`
      ),
      evidenceRefs: [
        `run-step:${params.sourceStepId}`,
        ...(params.checkpointId ? [`run-checkpoint:${params.checkpointId}`] : [])
      ],
      confidence: 0.84,
      freshness: 'volatile'
    })
  }

  private createMemoryIfAbsent(input: CreateMemoryBaseInput): void {
    if (this.memoryStore.get(input.id)) {
      return
    }

    this.memoryStore.create({
      id: input.id,
      scope: input.scope,
      runId: input.runId,
      sessionId: input.sessionId,
      sourceStepId: input.sourceStepId,
      kind: input.kind,
      summary: input.summary,
      payloadUri: input.payloadUri ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      confidence: input.confidence,
      freshness: input.freshness,
      supersedes: [],
      createdAt: Date.now(),
      expiresAt: null
    })
  }
}
