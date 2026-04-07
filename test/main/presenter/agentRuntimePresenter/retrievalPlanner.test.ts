import { describe, expect, it } from 'vitest'
import { DeepChatRetrievalPlanner } from '@/presenter/agentRuntimePresenter/retrievalPlanner'

describe('DeepChatRetrievalPlanner', () => {
  it('builds a bounded working-memory prompt section from run state and recent memory', () => {
    const planner = new DeepChatRetrievalPlanner(
      {
        listBySession: () => [
          {
            id: 'memory-1',
            scope: 'episodic',
            kind: 'failure',
            summary: 'Run failure (error): tests failed',
            evidenceRefs: ['run-step:step-1'],
            confidence: 0.84,
            freshness: 'volatile',
            supersedes: [],
            createdAt: 1
          },
          {
            id: 'memory-2',
            scope: 'evidence',
            kind: 'artifact',
            summary: 'read produced evidence: README content',
            payloadUri: '/tmp/readme.txt',
            evidenceRefs: ['run-step:step-2'],
            confidence: 0.92,
            freshness: 'volatile',
            supersedes: [],
            createdAt: 2
          }
        ]
      } as any,
      {
        build: () => ({
          runId: 'run-1',
          sessionId: 'session-1',
          title: 'Retry tests',
          goal: 'Retry tests',
          status: 'ready',
          stage: 'verify',
          progressDone: 0,
          progressTotal: 0,
          currentTaskId: null,
          currentTaskTitle: null,
          activeCheckpointId: 'cp-1',
          activeCheckpointLabel: 'Failure checkpoint',
          blockerSummary: null,
          tickerSummary: 'Retry tests',
          completionAcknowledged: false,
          updatedAt: 1
        })
      } as any
    )

    const section = planner.buildPromptSection(planner.buildWorkingSet('session-1', {} as any))

    expect(section).toContain('## Working Memory')
    expect(section).toContain('### Run State')
    expect(section).toContain('Active checkpoint: Failure checkpoint')
    expect(section).toContain('### Recent Episodic Memory')
    expect(section).toContain('Run failure (error): tests failed')
    expect(section).toContain('### Recent Evidence Memory')
    expect(section).toContain('read produced evidence: README content')
  })

  it('returns null when there is no memory and no relevant run signal', () => {
    const planner = new DeepChatRetrievalPlanner(
      {
        listBySession: () => []
      } as any,
      {
        build: () => ({
          runId: 'run-1',
          sessionId: 'session-1',
          title: 'Fresh run',
          goal: 'Fresh run',
          status: 'planning',
          stage: 'intent',
          progressDone: 0,
          progressTotal: 0,
          currentTaskId: null,
          currentTaskTitle: null,
          activeCheckpointId: null,
          activeCheckpointLabel: null,
          blockerSummary: null,
          tickerSummary: 'Fresh run',
          completionAcknowledged: false,
          updatedAt: 1
        })
      } as any
    )

    expect(planner.buildPromptSection(planner.buildWorkingSet('session-1', {} as any))).toBeNull()
  })
})
