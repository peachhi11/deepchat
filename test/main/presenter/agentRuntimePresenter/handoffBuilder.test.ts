import { describe, expect, it } from 'vitest'
import { buildRunHandoffMarkdown } from '@/presenter/agentRuntimePresenter/handoffBuilder'

describe('buildRunHandoffMarkdown', () => {
  it('renders recent episodic and evidence memory when provided', () => {
    const markdown = buildRunHandoffMarkdown({
      run: {
        id: 'run-1',
        sessionId: 'session-1',
        title: 'Recover run',
        goal: 'Recover run',
        status: 'recovering',
        stage: 'handoff',
        createdAt: 1,
        updatedAt: 1
      },
      summaryState: {
        summaryText: 'summary',
        summaryCursorOrderSeq: 3,
        summaryUpdatedAt: 100
      },
      checkpointLabel: 'Failure checkpoint',
      source: 'failure',
      nextStep: 'Recover safely',
      errorMessage: 'tests failed',
      recentMemories: [
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
    })

    expect(markdown).toContain('## Recent Memory')
    expect(markdown).toContain('- [episodic] Run failure (error): tests failed [run-step:step-1]')
    expect(markdown).toContain(
      '- [evidence] read produced evidence: README content [payload=/tmp/readme.txt, run-step:step-2]'
    )
  })
})
