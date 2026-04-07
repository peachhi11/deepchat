import type { HarnessRun } from '@shared/types/agent-interface'
import type { DeepChatRunRow } from '../sqlitePresenter/tables/deepchatRuns'
import { SQLitePresenter } from '../sqlitePresenter'

const toHarnessRun = (row: DeepChatRunRow): HarnessRun => ({
  id: row.id,
  sessionId: row.session_id,
  parentRunId: row.parent_run_id,
  originCheckpointId: row.origin_checkpoint_id,
  title: row.title,
  goal: row.goal,
  status: row.status,
  stage: row.stage,
  currentTaskId: row.current_task_id,
  currentStepId: row.current_step_id,
  activeCheckpointId: row.active_checkpoint_id,
  environmentId: row.environment_id,
  triggerMessageId: row.trigger_message_id,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export class DeepChatRunStore {
  private sqlitePresenter: SQLitePresenter

  constructor(sqlitePresenter: SQLitePresenter) {
    this.sqlitePresenter = sqlitePresenter
  }

  create(run: HarnessRun): void {
    this.sqlitePresenter.deepchatRunsTable.insert(run)
  }

  get(id: string): HarnessRun | null {
    const row = this.sqlitePresenter.deepchatRunsTable.get(id)
    return row ? toHarnessRun(row) : null
  }

  listBySession(sessionId: string): HarnessRun[] {
    return this.sqlitePresenter.deepchatRunsTable.listBySession(sessionId).map(toHarnessRun)
  }

  getLatestBySession(sessionId: string): HarnessRun | null {
    const row = this.sqlitePresenter.deepchatRunsTable.getLatestBySession(sessionId)
    return row ? toHarnessRun(row) : null
  }

  update(
    id: string,
    fields: Partial<
      Omit<HarnessRun, 'id' | 'sessionId' | 'createdAt' | 'parentRunId' | 'originCheckpointId'>
    > &
      Pick<Partial<HarnessRun>, 'parentRunId' | 'originCheckpointId'>
  ): void {
    this.sqlitePresenter.deepchatRunsTable.update(id, {
      parent_run_id: fields.parentRunId,
      origin_checkpoint_id: fields.originCheckpointId,
      title: fields.title,
      goal: fields.goal,
      status: fields.status,
      stage: fields.stage,
      current_task_id: fields.currentTaskId,
      current_step_id: fields.currentStepId,
      active_checkpoint_id: fields.activeCheckpointId,
      environment_id: fields.environmentId,
      trigger_message_id: fields.triggerMessageId,
      started_at: fields.startedAt,
      completed_at: fields.completedAt,
      updated_at: fields.updatedAt
    })
  }

  deleteBySession(sessionId: string): void {
    this.sqlitePresenter.deepchatRunsTable.deleteBySession(sessionId)
  }
}
