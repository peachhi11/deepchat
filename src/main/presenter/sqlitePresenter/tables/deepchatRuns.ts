import Database from 'better-sqlite3-multiple-ciphers'
import type { RunStage, RunStatus } from '@shared/types/agent-interface'
import { BaseTable } from './baseTable'

export interface DeepChatRunRow {
  id: string
  session_id: string
  parent_run_id: string | null
  origin_checkpoint_id: string | null
  title: string
  goal: string
  status: RunStatus
  stage: RunStage
  current_task_id: string | null
  current_step_id: string | null
  active_checkpoint_id: string | null
  environment_id: string | null
  trigger_message_id: string | null
  started_at: number | null
  completed_at: number | null
  created_at: number
  updated_at: number
}

export class DeepChatRunsTable extends BaseTable {
  constructor(db: Database.Database) {
    super(db, 'deepchat_runs')
  }

  getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS deepchat_runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        parent_run_id TEXT,
        origin_checkpoint_id TEXT,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        stage TEXT NOT NULL,
        current_task_id TEXT,
        current_step_id TEXT,
        active_checkpoint_id TEXT,
        environment_id TEXT,
        trigger_message_id TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_deepchat_runs_session_updated
        ON deepchat_runs(session_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deepchat_runs_session_status
        ON deepchat_runs(session_id, status, updated_at DESC);
    `
  }

  getMigrationSQL(version: number): string | null {
    if (version === 23) {
      return this.getCreateTableSQL()
    }
    return null
  }

  getLatestVersion(): number {
    return 23
  }

  insert(row: {
    id: string
    sessionId: string
    parentRunId?: string | null
    originCheckpointId?: string | null
    title: string
    goal: string
    status: RunStatus
    stage: RunStage
    currentTaskId?: string | null
    currentStepId?: string | null
    activeCheckpointId?: string | null
    environmentId?: string | null
    triggerMessageId?: string | null
    startedAt?: number | null
    completedAt?: number | null
    createdAt?: number
    updatedAt?: number
  }): void {
    const createdAt = row.createdAt ?? Date.now()
    const updatedAt = row.updatedAt ?? createdAt
    this.db
      .prepare(
        `INSERT INTO deepchat_runs (
          id,
          session_id,
          parent_run_id,
          origin_checkpoint_id,
          title,
          goal,
          status,
          stage,
          current_task_id,
          current_step_id,
          active_checkpoint_id,
          environment_id,
          trigger_message_id,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.sessionId,
        row.parentRunId ?? null,
        row.originCheckpointId ?? null,
        row.title,
        row.goal,
        row.status,
        row.stage,
        row.currentTaskId ?? null,
        row.currentStepId ?? null,
        row.activeCheckpointId ?? null,
        row.environmentId ?? null,
        row.triggerMessageId ?? null,
        row.startedAt ?? null,
        row.completedAt ?? null,
        createdAt,
        updatedAt
      )
  }

  get(id: string): DeepChatRunRow | undefined {
    return this.db.prepare('SELECT * FROM deepchat_runs WHERE id = ?').get(id) as
      | DeepChatRunRow
      | undefined
  }

  listBySession(sessionId: string): DeepChatRunRow[] {
    return this.db
      .prepare('SELECT * FROM deepchat_runs WHERE session_id = ? ORDER BY updated_at DESC')
      .all(sessionId) as DeepChatRunRow[]
  }

  getLatestBySession(sessionId: string): DeepChatRunRow | undefined {
    return this.db
      .prepare('SELECT * FROM deepchat_runs WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1')
      .get(sessionId) as DeepChatRunRow | undefined
  }

  update(
    id: string,
    fields: Partial<
      Pick<
        DeepChatRunRow,
        | 'parent_run_id'
        | 'origin_checkpoint_id'
        | 'title'
        | 'goal'
        | 'status'
        | 'stage'
        | 'current_task_id'
        | 'current_step_id'
        | 'active_checkpoint_id'
        | 'environment_id'
        | 'trigger_message_id'
        | 'started_at'
        | 'completed_at'
        | 'updated_at'
      >
    >
  ): void {
    const setClauses: string[] = []
    const params: unknown[] = []

    if (fields.parent_run_id !== undefined) {
      setClauses.push('parent_run_id = ?')
      params.push(fields.parent_run_id)
    }
    if (fields.origin_checkpoint_id !== undefined) {
      setClauses.push('origin_checkpoint_id = ?')
      params.push(fields.origin_checkpoint_id)
    }
    if (fields.title !== undefined) {
      setClauses.push('title = ?')
      params.push(fields.title)
    }
    if (fields.goal !== undefined) {
      setClauses.push('goal = ?')
      params.push(fields.goal)
    }
    if (fields.status !== undefined) {
      setClauses.push('status = ?')
      params.push(fields.status)
    }
    if (fields.stage !== undefined) {
      setClauses.push('stage = ?')
      params.push(fields.stage)
    }
    if (fields.current_task_id !== undefined) {
      setClauses.push('current_task_id = ?')
      params.push(fields.current_task_id)
    }
    if (fields.current_step_id !== undefined) {
      setClauses.push('current_step_id = ?')
      params.push(fields.current_step_id)
    }
    if (fields.active_checkpoint_id !== undefined) {
      setClauses.push('active_checkpoint_id = ?')
      params.push(fields.active_checkpoint_id)
    }
    if (fields.environment_id !== undefined) {
      setClauses.push('environment_id = ?')
      params.push(fields.environment_id)
    }
    if (fields.trigger_message_id !== undefined) {
      setClauses.push('trigger_message_id = ?')
      params.push(fields.trigger_message_id)
    }
    if (fields.started_at !== undefined) {
      setClauses.push('started_at = ?')
      params.push(fields.started_at)
    }
    if (fields.completed_at !== undefined) {
      setClauses.push('completed_at = ?')
      params.push(fields.completed_at)
    }

    if (setClauses.length === 0 && fields.updated_at === undefined) {
      return
    }

    setClauses.push('updated_at = ?')
    params.push(fields.updated_at ?? Date.now())
    params.push(id)

    this.db.prepare(`UPDATE deepchat_runs SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)
  }

  deleteBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM deepchat_runs WHERE session_id = ?').run(sessionId)
  }
}
