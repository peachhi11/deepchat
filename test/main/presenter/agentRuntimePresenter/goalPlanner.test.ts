import { describe, expect, it } from 'vitest'
import {
  buildGoalPlannerMessages,
  parsePlannedRunIntent
} from '@/presenter/agentRuntimePresenter/goalPlanner'

describe('goalPlanner', () => {
  it('builds planner messages with active run context when available', () => {
    const messages = buildGoalPlannerMessages({
      text: 'Continue',
      projectDir: '/workspace/app',
      currentTitle: 'Refactor checkpoint flow',
      currentGoal: 'Refactor checkpoint flow and verify behavior'
    })

    expect(messages).toEqual([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('preserve and refine that run')
      }),
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('Active run title: Refactor checkpoint flow')
      })
    ])
    expect(messages[1]?.content).toContain(
      'Active run goal: Refactor checkpoint flow and verify behavior'
    )
    expect(messages[1]?.content).toContain('Project directory: /workspace/app')
  })

  it('parses planner JSON and falls back when parsing fails', () => {
    expect(
      parsePlannedRunIntent(
        '{"title":"Refactor checkpoint flow","goal":"Refactor checkpoint flow and verify behavior","acceptanceCriteria":["Update checkpoint transitions","Verify retry behavior"]}',
        {
          title: 'Fallback title',
          goal: 'Fallback goal'
        }
      )
    ).toEqual({
      title: 'Refactor checkpoint flow',
      goal: 'Refactor checkpoint flow and verify behavior',
      acceptanceCriteria: ['Update checkpoint transitions', 'Verify retry behavior'],
      source: 'model'
    })

    expect(
      parsePlannedRunIntent('not-json', {
        title: 'Fallback title',
        goal: 'Fallback goal'
      })
    ).toEqual({
      title: 'Fallback title',
      goal: 'Fallback goal',
      acceptanceCriteria: [],
      source: 'fallback'
    })
  })
})
