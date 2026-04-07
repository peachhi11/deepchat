import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeepChatMemoryRecordRow } from '@/presenter/sqlitePresenter/tables/deepchatMemoryRecords'
import { DeepChatMemoryStore } from '@/presenter/agentRuntimePresenter/memoryStore'

describe('DeepChatMemoryStore', () => {
  const insert = vi.fn()
  const get = vi.fn()
  const listBySession = vi.fn()
  const deleteBySession = vi.fn()

  const sqlitePresenter = {
    deepchatMemoryRecordsTable: {
      insert,
      get,
      listBySession,
      deleteBySession
    }
  } as any

  let store: DeepChatMemoryStore

  const row: DeepChatMemoryRecordRow = {
    id: 'memory-1',
    scope: 'evidence',
    run_id: 'run-1',
    session_id: 'session-1',
    workspace_id: null,
    task_id: null,
    source_step_id: 'step-1',
    kind: 'artifact',
    summary: 'read produced evidence',
    payload_uri: '/tmp/evidence.txt',
    evidence_refs_json: '["run-step:step-1"]',
    confidence: 0.92,
    freshness: 'volatile',
    supersedes_json: '[]',
    created_at: 10,
    expires_at: null
  }

  beforeEach(() => {
    insert.mockReset()
    get.mockReset()
    listBySession.mockReset()
    deleteBySession.mockReset()
    store = new DeepChatMemoryStore(sqlitePresenter)
  })

  it('maps sqlite rows back to shared MemoryRecord records', () => {
    get.mockReturnValue(row)

    expect(store.get('memory-1')).toEqual({
      id: 'memory-1',
      scope: 'evidence',
      runId: 'run-1',
      sessionId: 'session-1',
      workspaceId: null,
      taskId: null,
      sourceStepId: 'step-1',
      kind: 'artifact',
      summary: 'read produced evidence',
      payloadUri: '/tmp/evidence.txt',
      evidenceRefs: ['run-step:step-1'],
      confidence: 0.92,
      freshness: 'volatile',
      supersedes: [],
      createdAt: 10,
      expiresAt: null
    })
  })

  it('delegates listBySession filters to the sqlite table', () => {
    listBySession.mockReturnValue([row])

    expect(
      store.listBySession('session-1', {
        scopes: ['evidence'],
        limit: 5
      })
    ).toHaveLength(1)
    expect(listBySession).toHaveBeenCalledWith('session-1', {
      scopes: ['evidence'],
      limit: 5
    })
  })
})
