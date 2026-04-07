import type { RunCheckpoint } from '@shared/types/agent-interface'
import type { DeepChatRunCheckpointRow } from '../sqlitePresenter/tables/deepchatRunCheckpoints'
import { SQLitePresenter } from '../sqlitePresenter'

const toRunCheckpoint = (row: DeepChatRunCheckpointRow): RunCheckpoint => ({
  id: row.id,
  runId: row.run_id,
  sessionId: row.session_id,
  checkpointType: row.checkpoint_type,
  label: row.label,
  payloadJson: row.payload_json,
  createdAt: row.created_at
})

export class DeepChatRunCheckpointStore {
  private readonly sqlitePresenter: SQLitePresenter

  constructor(sqlitePresenter: SQLitePresenter) {
    this.sqlitePresenter = sqlitePresenter
  }

  create(checkpoint: RunCheckpoint): void {
    this.sqlitePresenter.deepchatRunCheckpointsTable.insert(checkpoint)
  }

  get(id: string): RunCheckpoint | null {
    const row = this.sqlitePresenter.deepchatRunCheckpointsTable.get(id)
    return row ? toRunCheckpoint(row) : null
  }

  deleteBySession(sessionId: string): void {
    this.sqlitePresenter.deepchatRunCheckpointsTable.deleteBySession(sessionId)
  }
}
