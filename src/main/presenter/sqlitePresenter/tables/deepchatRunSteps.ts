import Database from 'better-sqlite3-multiple-ciphers'
import type { RunStepKind, RunStepStatus } from '@shared/types/agent-interface'
import { BaseTable } from './baseTable'

export interface DeepChatRunStepRow {
  id: string
  run_id: string
  session_id: string
  message_id: string | null
  tool_call_id: string | null
  kind: RunStepKind
  title: string
  status: RunStepStatus
  payload_json: string | null
  created_at: number
  updated_at: number
  completed_at: number | null
}

export class DeepChatRunStepsTable extends BaseTable {
  constructor(db: Database.Database) {
    super(db, 'deepchat_run_steps')
  }

  getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS deepchat_run_steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        message_id TEXT,
        tool_call_id TEXT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_deepchat_run_steps_run_created
        ON deepchat_run_steps(run_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deepchat_run_steps_run_status
        ON deepchat_run_steps(run_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deepchat_run_steps_session_status
        ON deepchat_run_steps(session_id, status, created_at DESC);
    `
  }

  getMigrationSQL(version: number): string | null {
    if (version === 24) {
      return this.getCreateTableSQL()
    }
    return null
  }

  getLatestVersion(): number {
    return 24
  }

  insert(row: {
    id: string
    runId: string
    sessionId: string
    messageId?: string | null
    toolCallId?: string | null
    kind: RunStepKind
    title: string
    status: RunStepStatus
    payloadJson?: string | null
    createdAt?: number
    updatedAt?: number
    completedAt?: number | null
  }): void {
    const createdAt = row.createdAt ?? Date.now()
    const updatedAt = row.updatedAt ?? createdAt
    this.db
      .prepare(
        `INSERT INTO deepchat_run_steps (
          id,
          run_id,
          session_id,
          message_id,
          tool_call_id,
          kind,
          title,
          status,
          payload_json,
          created_at,
          updated_at,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.runId,
        row.sessionId,
        row.messageId ?? null,
        row.toolCallId ?? null,
        row.kind,
        row.title,
        row.status,
        row.payloadJson ?? null,
        createdAt,
        updatedAt,
        row.completedAt ?? null
      )
  }

  get(id: string): DeepChatRunStepRow | undefined {
    return this.db.prepare('SELECT * FROM deepchat_run_steps WHERE id = ?').get(id) as
      | DeepChatRunStepRow
      | undefined
  }

  getLatestPendingWaitStep(runId: string): DeepChatRunStepRow | undefined {
    return this.db
      .prepare(
        `SELECT *
         FROM deepchat_run_steps
         WHERE run_id = ?
           AND kind = 'wait'
           AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(runId) as DeepChatRunStepRow | undefined
  }

  update(
    id: string,
    fields: Partial<
      Pick<DeepChatRunStepRow, 'title' | 'status' | 'payload_json' | 'updated_at' | 'completed_at'>
    >
  ): void {
    const setClauses: string[] = []
    const params: unknown[] = []

    if (fields.title !== undefined) {
      setClauses.push('title = ?')
      params.push(fields.title)
    }
    if (fields.status !== undefined) {
      setClauses.push('status = ?')
      params.push(fields.status)
    }
    if (fields.payload_json !== undefined) {
      setClauses.push('payload_json = ?')
      params.push(fields.payload_json)
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

    this.db
      .prepare(`UPDATE deepchat_run_steps SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...params)
  }

  deleteBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM deepchat_run_steps WHERE session_id = ?').run(sessionId)
  }
}
