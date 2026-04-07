import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeepChatRunRow } from '@/presenter/sqlitePresenter/tables/deepchatRuns'
import { DeepChatRunStore } from '@/presenter/agentRuntimePresenter/runStore'

describe('DeepChatRunStore', () => {
  const insert = vi.fn()
  const get = vi.fn()
  const listBySession = vi.fn()
  const getLatestBySession = vi.fn()
  const update = vi.fn()
  const deleteBySession = vi.fn()

  const sqlitePresenter = {
    deepchatRunsTable: {
      insert,
      get,
      listBySession,
      getLatestBySession,
      update,
      deleteBySession
    }
  } as any

  let store: DeepChatRunStore

  const row: DeepChatRunRow = {
    id: 'run-1',
    session_id: 'session-1',
    parent_run_id: null,
    origin_checkpoint_id: null,
    title: 'Implement run store',
    goal: 'Add durable run skeleton',
    status: 'planning',
    stage: 'plan',
    current_task_id: null,
    current_step_id: null,
    active_checkpoint_id: null,
    environment_id: null,
    trigger_message_id: 'msg-1',
    started_at: 10,
    completed_at: null,
    created_at: 10,
    updated_at: 20
  }

  beforeEach(() => {
    insert.mockReset()
    get.mockReset()
    listBySession.mockReset()
    getLatestBySession.mockReset()
    update.mockReset()
    deleteBySession.mockReset()
    store = new DeepChatRunStore(sqlitePresenter)
  })

  it('maps sqlite rows back to shared HarnessRun records', () => {
    get.mockReturnValue(row)

    expect(store.get('run-1')).toEqual({
      id: 'run-1',
      sessionId: 'session-1',
      parentRunId: null,
      originCheckpointId: null,
      title: 'Implement run store',
      goal: 'Add durable run skeleton',
      status: 'planning',
      stage: 'plan',
      currentTaskId: null,
      currentStepId: null,
      activeCheckpointId: null,
      environmentId: null,
      triggerMessageId: 'msg-1',
      startedAt: 10,
      completedAt: null,
      createdAt: 10,
      updatedAt: 20
    })
  })

  it('delegates updates with snake_case fields for the sqlite table', () => {
    store.update('run-1', {
      status: 'executing',
      stage: 'task',
      currentStepId: 'step-1',
      updatedAt: 30
    })

    expect(update).toHaveBeenCalledWith('run-1', {
      parent_run_id: undefined,
      origin_checkpoint_id: undefined,
      title: undefined,
      goal: undefined,
      status: 'executing',
      stage: 'task',
      current_task_id: undefined,
      current_step_id: 'step-1',
      active_checkpoint_id: undefined,
      environment_id: undefined,
      trigger_message_id: undefined,
      started_at: undefined,
      completed_at: undefined,
      updated_at: 30
    })
  })

  it('returns the most recently updated run for a session', () => {
    getLatestBySession.mockReturnValue(row)

    expect(store.getLatestBySession('session-1')?.id).toBe('run-1')
    expect(getLatestBySession).toHaveBeenCalledWith('session-1')
  })
})
