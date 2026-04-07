import type { MemoryRecord } from '@shared/types/agent-interface'
import type { DeepChatMemoryRecordRow } from '../sqlitePresenter/tables/deepchatMemoryRecords'
import { SQLitePresenter } from '../sqlitePresenter'

const parseStringArray = (value: string | null | undefined): string[] => {
  if (!value?.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : []
  } catch {
    return []
  }
}

const toMemoryRecord = (row: DeepChatMemoryRecordRow): MemoryRecord => ({
  id: row.id,
  scope: row.scope,
  runId: row.run_id,
  sessionId: row.session_id,
  workspaceId: row.workspace_id,
  taskId: row.task_id,
  sourceStepId: row.source_step_id,
  kind: row.kind,
  summary: row.summary,
  payloadUri: row.payload_uri,
  evidenceRefs: parseStringArray(row.evidence_refs_json),
  confidence: row.confidence,
  freshness: row.freshness,
  supersedes: parseStringArray(row.supersedes_json),
  createdAt: row.created_at,
  expiresAt: row.expires_at
})

export class DeepChatMemoryStore {
  private readonly sqlitePresenter: SQLitePresenter

  constructor(sqlitePresenter: SQLitePresenter) {
    this.sqlitePresenter = sqlitePresenter
  }

  create(record: MemoryRecord): void {
    this.sqlitePresenter.deepchatMemoryRecordsTable.insert(record)
  }

  get(id: string): MemoryRecord | null {
    const row = this.sqlitePresenter.deepchatMemoryRecordsTable.get(id)
    return row ? toMemoryRecord(row) : null
  }

  listBySession(
    sessionId: string,
    options?: {
      scopes?: MemoryRecord['scope'][]
      limit?: number
    }
  ): MemoryRecord[] {
    return this.sqlitePresenter.deepchatMemoryRecordsTable
      .listBySession(sessionId, options)
      .map(toMemoryRecord)
  }

  deleteBySession(sessionId: string): void {
    this.sqlitePresenter.deepchatMemoryRecordsTable.deleteBySession(sessionId)
  }
}
