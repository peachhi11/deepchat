import Database from 'better-sqlite3-multiple-ciphers'
import type { MemoryFreshness, MemoryKind, MemoryScope } from '@shared/types/agent-interface'
import { BaseTable } from './baseTable'

export interface DeepChatMemoryRecordRow {
  id: string
  scope: MemoryScope
  run_id: string | null
  session_id: string | null
  workspace_id: string | null
  task_id: string | null
  source_step_id: string | null
  kind: MemoryKind
  summary: string
  payload_uri: string | null
  evidence_refs_json: string
  confidence: number
  freshness: MemoryFreshness
  supersedes_json: string
  created_at: number
  expires_at: number | null
}

export class DeepChatMemoryRecordsTable extends BaseTable {
  constructor(db: Database.Database) {
    super(db, 'deepchat_memory_records')
  }

  getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS deepchat_memory_records (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        run_id TEXT,
        session_id TEXT,
        workspace_id TEXT,
        task_id TEXT,
        source_step_id TEXT,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_uri TEXT,
        evidence_refs_json TEXT NOT NULL DEFAULT '[]',
        confidence REAL NOT NULL,
        freshness TEXT NOT NULL,
        supersedes_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_deepchat_memory_records_session_scope_created
        ON deepchat_memory_records(session_id, scope, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deepchat_memory_records_run_created
        ON deepchat_memory_records(run_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deepchat_memory_records_source_step
        ON deepchat_memory_records(source_step_id);
    `
  }

  getMigrationSQL(version: number): string | null {
    if (version === 26) {
      return this.getCreateTableSQL()
    }
    return null
  }

  getLatestVersion(): number {
    return 26
  }

  insert(row: {
    id: string
    scope: MemoryScope
    runId?: string | null
    sessionId?: string | null
    workspaceId?: string | null
    taskId?: string | null
    sourceStepId?: string | null
    kind: MemoryKind
    summary: string
    payloadUri?: string | null
    evidenceRefs?: string[]
    confidence: number
    freshness: MemoryFreshness
    supersedes?: string[]
    createdAt?: number
    expiresAt?: number | null
  }): void {
    this.db
      .prepare(
        `INSERT INTO deepchat_memory_records (
          id,
          scope,
          run_id,
          session_id,
          workspace_id,
          task_id,
          source_step_id,
          kind,
          summary,
          payload_uri,
          evidence_refs_json,
          confidence,
          freshness,
          supersedes_json,
          created_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.scope,
        row.runId ?? null,
        row.sessionId ?? null,
        row.workspaceId ?? null,
        row.taskId ?? null,
        row.sourceStepId ?? null,
        row.kind,
        row.summary,
        row.payloadUri ?? null,
        JSON.stringify(row.evidenceRefs ?? []),
        row.confidence,
        row.freshness,
        JSON.stringify(row.supersedes ?? []),
        row.createdAt ?? Date.now(),
        row.expiresAt ?? null
      )
  }

  get(id: string): DeepChatMemoryRecordRow | undefined {
    return this.db.prepare('SELECT * FROM deepchat_memory_records WHERE id = ?').get(id) as
      | DeepChatMemoryRecordRow
      | undefined
  }

  listBySession(
    sessionId: string,
    options?: {
      scopes?: MemoryScope[]
      limit?: number
    }
  ): DeepChatMemoryRecordRow[] {
    const conditions = ['session_id = ?']
    const params: Array<string | number> = [sessionId]

    if (options?.scopes?.length) {
      conditions.push(`scope IN (${options.scopes.map(() => '?').join(', ')})`)
      params.push(...options.scopes)
    }

    const limitClause =
      typeof options?.limit === 'number' ? ` LIMIT ${Math.max(1, options.limit)}` : ''

    return this.db
      .prepare(
        `SELECT * FROM deepchat_memory_records WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC${limitClause}`
      )
      .all(...params) as DeepChatMemoryRecordRow[]
  }

  deleteBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM deepchat_memory_records WHERE session_id = ?').run(sessionId)
  }
}
