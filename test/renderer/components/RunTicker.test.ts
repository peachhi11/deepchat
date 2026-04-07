import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RunTicker from '@/components/chat/RunTicker.vue'
import type { RunSnapshot } from '@shared/types/agent-interface'

const createSnapshot = (overrides: Partial<RunSnapshot> = {}): RunSnapshot => ({
  runId: 'run-1',
  sessionId: 's1',
  title: 'Implement run ticker',
  goal: 'Implement run ticker',
  status: 'executing',
  stage: 'task',
  progressDone: 0,
  progressTotal: 0,
  currentTaskId: null,
  currentTaskTitle: null,
  activeCheckpointId: null,
  activeCheckpointLabel: null,
  blockerSummary: null,
  tickerSummary: 'Implement run ticker',
  completionAcknowledged: false,
  updatedAt: 1,
  ...overrides
})

describe('RunTicker', () => {
  it('collapses ready snapshots into a compact check island', () => {
    const wrapper = mount(RunTicker, {
      props: {
        snapshot: createSnapshot({
          status: 'ready',
          stage: 'verify'
        })
      }
    })

    expect(wrapper.find('[data-run-ticker="compact"]').exists()).toBe(true)
    expect(wrapper.find('[data-run-status="ready"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('✓')
  })

  it('emits acknowledge when the compact check island is clicked', async () => {
    const wrapper = mount(RunTicker, {
      props: {
        snapshot: createSnapshot({
          status: 'ready',
          stage: 'verify'
        })
      }
    })

    await wrapper.get('button[data-run-ticker="compact"]').trigger('click')

    expect(wrapper.emitted('acknowledge')).toEqual([[]])
  })

  it('uses blocker summary and keeps the expanded island for waiting states', () => {
    const wrapper = mount(RunTicker, {
      props: {
        snapshot: createSnapshot({
          status: 'waiting_permission',
          blockerSummary: 'Need permission to write package.json'
        })
      }
    })

    expect(wrapper.find('[data-run-ticker="active"]').exists()).toBe(true)
    expect(wrapper.find('[data-run-status="waiting_permission"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Waiting')
    expect(wrapper.text()).toContain('Need permission to write package.json')
    expect(wrapper.text()).toContain('Task')
  })
})
