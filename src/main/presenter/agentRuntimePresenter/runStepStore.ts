import type { RunStepRecord } from '@shared/types/agent-interface'
import type { DeepChatRunStepRow } from '../sqlitePresenter/tables/deepchatRunSteps'
import { SQLitePresenter } from '../sqlitePresenter'

const toRunStepRecord = (row: DeepChatRunStepRow): RunStepRecord => ({
  id: row.id,
  runId: row.run_id,
  sessionId: row.session_id,
  messageId: row.message_id,
  toolCallId: row.tool_call_id,
  kind: row.kind,
  title: row.title,
  status: row.status,
  payloadJson: row.payload_json,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at
})

export class DeepChatRunStepStore {
  private readonly sqlitePresenter: SQLitePresenter

  constructor(sqlitePresenter: SQLitePresenter) {
    this.sqlitePresenter = sqlitePresenter
  }

  create(step: RunStepRecord): void {
    this.sqlitePresenter.deepchatRunStepsTable.insert(step)
  }

  get(id: string): RunStepRecord | null {
    const row = this.sqlitePresenter.deepchatRunStepsTable.get(id)
    return row ? toRunStepRecord(row) : null
  }

  getLatestPendingWaitStep(runId: string): RunStepRecord | null {
    const row = this.sqlitePresenter.deepchatRunStepsTable.getLatestPendingWaitStep(runId)
    return row ? toRunStepRecord(row) : null
  }

  update(
    id: string,
    fields: Partial<
      Pick<RunStepRecord, 'title' | 'status' | 'payloadJson' | 'updatedAt' | 'completedAt'>
    >
  ): void {
    this.sqlitePresenter.deepchatRunStepsTable.update(id, {
      title: fields.title,
      status: fields.status,
      payload_json: fields.payloadJson,
      updated_at: fields.updatedAt,
      completed_at: fields.completedAt
    })
  }

  deleteBySession(sessionId: string): void {
    this.sqlitePresenter.deepchatRunStepsTable.deleteBySession(sessionId)
  }
}
