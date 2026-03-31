# Project Memory Notebook Plan

> Superseded by [global-memory-pool](../global-memory-pool/plan.md).
> This document is kept only as an earlier design snapshot.

## Key Decisions

1. Extend existing project infrastructure instead of introducing a standalone notebook presenter in v1.
2. Store notebook entries in SQLite and cache summaries in memory.
3. Add explicit agent tools for notebook read and write.
4. Keep write authority with the main session path; child sessions default to read-only behavior.
5. Separate notebook storage from notebook prompt injection so prompt pollution stays bounded.

## Data Model

Add `project_memory_entries` with fields equivalent to:

- `id`
- `project_path`
- `kind`
- `content`
- `created_by`
- `source_session_id`
- `source_message_id`
- `created_at`
- `updated_at`
- `pinned`
- `archived_at`
- `replaced_by_id`
- `version`

V1 does not require a persisted summary table. Notebook summaries are derived on demand and cached in memory by project path plus version.

## Main Process Changes

1. Extend `ProjectPresenter` and shared project presenter types with notebook CRUD and summary APIs.
2. Add notebook persistence support in `SQLitePresenter`.
3. Add agent-facing tools:
   - `project_memory_read`
   - `project_memory_write`
4. Implement a write pipeline:
   - receive candidate
   - validate provenance
   - run sensitive-content filter
   - run transient-content filter
   - merge or archive conflicts
   - persist entry
5. Add a recent-write undo path for the last automatic notebook write.

## Prompt and Tool Integration

1. Notebook summaries are appended during system-prompt assembly only when a session has a matching `projectDir`.
2. The summary includes pinned and high-value entries only.
3. The summary participates in prompt stability rules and must not explode prompt size.
4. Full notebook detail is fetched through `project_memory_read`, not by default prompt injection.

## Renderer Changes

1. Add a `Notebook` section to the existing workspace sidepanel.
2. Show notebook entry provenance and actions:
   - pin
   - archive
   - delete
   - open source
   - undo recent write
3. Add a project or environment management entry point for notebook review outside the active chat.

## Test Plan

- Entries are scoped correctly by normalized project path.
- Writes without source evidence are rejected.
- Sensitive candidates are rejected without storing raw blocked content.
- Transient facts such as current `git status` or one-off failures are rejected.
- Summary injection happens only for matching project sessions.
- Notebook tools are unavailable or read-only in restricted child-session contexts.
- Undo restores the previous state for the most recent automatic write.

## Risks and Mitigations

- Risk: notebook becomes a hidden memory dump that users cannot trust.
  Mitigation: provenance, UI visibility, and undo are first-class requirements.
- Risk: automatic writes capture transient or misleading facts.
  Mitigation: require evidence, run transient filters, and archive instead of silent overwrite.
- Risk: prompt pollution degrades cache behavior or model quality.
  Mitigation: keep full notebooks out of the default prompt and inject compact summaries only.
