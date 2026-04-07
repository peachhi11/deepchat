import Database from 'better-sqlite3-multiple-ciphers'
import type { RunCheckpointType } from '@shared/types/agent-interface'
import { BaseTable } from './baseTable'

export interface DeepChatRunCheckpointRow {
  id: string
  run_id: string
  session_id: string
  checkpoint_type: RunCheckpointType
  label: string
  payload_json: string | null
  created_at: number
}

export class DeepChatRunCheckpointsTable extends BaseTable {
  constructor(db: Database.Database) {
    super(db, 'deepchat_run_checkpoints')
  }

  getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS deepchat_run_checkpoints (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        checkpoint_type TEXT NOT NULL,
        label TEXT NOT NULL,
        payload_json TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_deepchat_run_checkpoints_run_created
        ON deepchat_run_checkpoints(run_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deepchat_run_checkpoints_session_created
        ON deepchat_run_checkpoints(session_id, created_at DESC);
    `
  }

  getMigrationSQL(version: number): string | null {
    if (version === 25) {
      return this.getCreateTableSQL()
    }
    return null
  }

  getLatestVersion(): number {
    return 25
  }

  insert(row: {
    id: string
    runId: string
    sessionId: string
    checkpointType: RunCheckpointType
    label: string
    payloadJson?: string | null
    createdAt?: number
  }): void {
    this.db
      .prepare(
        `INSERT INTO deepchat_run_checkpoints (
          id,
          run_id,
          session_id,
          checkpoint_type,
          label,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.runId,
        row.sessionId,
        row.checkpointType,
        row.label,
        row.payloadJson ?? null,
        row.createdAt ?? Date.now()
      )
  }

  get(id: string): DeepChatRunCheckpointRow | undefined {
    return this.db.prepare('SELECT * FROM deepchat_run_checkpoints WHERE id = ?').get(id) as
      | DeepChatRunCheckpointRow
      | undefined
  }

  deleteBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM deepchat_run_checkpoints WHERE session_id = ?').run(sessionId)
  }
}
