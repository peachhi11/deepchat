# Global Memory Pool 计划

## Key Decisions

1. Replace `project-memory-notebook` with one `global-memory-pool`.
2. Use a dedicated DuckDB-backed memory store in DeepChat data space.
3. Reuse DuckDB infrastructure patterns from the built-in knowledge base, but do not reuse the file/chunk/file-upload schema.
4. Keep memory product exposure weak and operational, not notebook-centric.
5. Use mixed retrieval: structured prefilter first, semantic reranking second.

## Storage Model

### Database

- Add a dedicated DeepChat memory database, for example:
  - `app_db/DeepChatMemory`
- Powered by the same DuckDB stack already used for built-in knowledge.

### Core Tables

- `memory_entry`
  - `id`
  - `project_key`
  - `kind`
  - `content`
  - `importance`
  - `created_at`
  - `last_accessed_at`
  - `last_used_at`
  - `source_session_id`
  - `source_message_id`
  - `expires_at`
  - `pinned`
  - `status('active' | 'merged' | 'forgotten')`
- `memory_vector`
  - `entry_id`
  - `embedding`
- `memory_audit`
  - `id`
  - `entry_id`
  - `action('create' | 'merge' | 'forget' | 'pin' | 'delete')`
  - `created_at`
  - `reason`

## Retrieval Model

### Structured Prefilter

- Filter by:
  - current `projectDir -> projectKey`
  - recency window
  - active status
  - optional kind filters
  - importance floor

### Semantic Reranking

- For the remaining candidate set, generate one query embedding and rerank by vector similarity.
- Do not run blind semantic search across the entire memory pool in v1.

### Prompt Injection

- Return only a compact summary block:
  - top relevant memories
  - maybe one recent decision
  - maybe one critical constraint
- Never inject full entry bodies by default.

## Autonomy Pipeline

### Turn-end Extraction

- After a successful assistant turn, autonomy may produce memory candidates from the session delta.
- Candidate filters:
  - reject secrets and tokens
  - reject obvious transient state
  - require provenance

### Merge and Dedup

- Merge near-duplicate memories within the same project and kind.
- Keep the newest active entry as canonical.
- Record merge history in `memory_audit`.

### Automatic Forgetting

- Run periodic maintenance per project bucket.
- Allowed actions for non-pinned entries:
  - lower importance
  - merge
  - mark forgotten
  - delete low-value old entries
- Default policy:
  - low-importance inactive entries expire first
  - older duplicate clusters collapse first
  - pinned entries are never auto-deleted

## Main / Shared / Renderer Changes

### Main

- Add a dedicated memory presenter/service that owns the memory DuckDB store.
- Hook turn-end extraction into the DeepChat runtime completion path.
- Add periodic maintenance scheduling for merge/forget passes.

### Shared

- Add:
  - `GlobalMemoryEntry`
  - `GlobalMemoryCandidate`
  - `GlobalMemorySummary`
  - `MemoryAutonomyEvent`

### Renderer

- Do not add a notebook sidepanel.
- Add a lightweight visibility surface for:
  - recent memory changes
  - per-agent/session autonomy toggle
  - limited actions such as pin, forget now, clear project memories

## Test Plan

- Entries are stored with correct project and provenance metadata.
- Retrieval first narrows by project/time and then reranks semantically.
- Prompt injection remains compact and bounded.
- Turn-end extraction rejects secrets and transient noise.
- Merge collapses duplicates without losing canonical provenance.
- Automatic forgetting never deletes pinned entries.
- Agent/session autonomy toggles override the global default correctly.

## Risk Mitigation

- Risk: memory becomes a second user-facing knowledge base.
  Mitigation: weak visibility only; no large notebook UI.
- Risk: semantic search returns cross-project noise.
  Mitigation: structured project/time prefilter before reranking.
- Risk: automatic forgetting becomes untrustworthy.
  Mitigation: keep audit records for create/merge/forget actions and protect pinned entries.
