# Project Memory Notebook

> Superseded by [global-memory-pool](../global-memory-pool/spec.md).
> This document is kept only as an earlier design snapshot.

## Summary

Add a project-scoped, auditable notebook for non-sensitive long-lived facts, decisions, and constraints. The notebook must be reviewable, revocable, and safe by default. It is not a hidden memory layer and it must not become a dumping ground for transient repository state.

## Background

DeepChat already persists sessions, messages, traces, projects, and environments in SQLite. It does not have a first-class project-scoped memory model for long-term agent facts. The existing `nowledgeMem` integration is an external conversation export path and is not suitable as an internal notebook.

The reference Claude Code memory concept is file-based and lightweight. DeepChat needs a stronger design:

- project-scoped instead of global
- auditable instead of opaque
- filtered for non-sensitive durable facts
- injected conservatively into prompts

## Goals

- Store durable, project-scoped memory entries with provenance.
- Support only non-sensitive and reviewable long-term facts.
- Make notebook entries visible and manageable by the user.
- Allow the agent to suggest and automatically persist valid candidates in v1, subject to strict filtering.
- Inject only a compact notebook summary into prompts when it is relevant to the current project.

## Non-Goals

- A secret vault or credential storage feature.
- Replacing session history, traces, or knowledge-base export.
- Raw full-notebook injection into every turn.
- Cross-project shared memory in v1.
- Semantic retrieval or vector search in v1.

## Acceptance Criteria

- Memory is scoped by normalized `project_path`.
- V1 entry kinds are:
  - `fact`
  - `decision`
  - `constraint`
- Every persisted entry records provenance, including:
  - source session
  - source message
  - author type
  - timestamps
- The default write policy is “suggest then auto-persist”, but persistence is allowed only when:
  - the candidate includes source evidence
  - the content passes sensitive-content filters
  - the content is judged durable rather than transient
- Blocked sensitive candidates are not persisted verbatim.
- Users can review, pin, archive, delete, and undo recent writes.
- The agent can read notebook summaries through a dedicated tool or prompt section.
- Notebook summaries are only injected when the session has a matching `projectDir`.
- Subagents are read-only by default for notebook access in v1.

## Constraints

- No raw sensitive data may be stored intentionally.
- Notebook content must remain explainable to the user.
- Prompt injection must remain compact and cache-friendly.
- This feature must not reuse the `nowledgeMem` export pipeline.
- The first implementation should reuse existing project and sidepanel architecture rather than inventing a separate notebook runtime.

## Compatibility / Migration

- Introduce a new SQLite table for notebook entries.
- No backfill is required in v1.
- Existing projects and environments remain unchanged if they have no notebook entries.

## Default Decisions

- Project scope key: normalized project path.
- Conflict handling: archive superseded entries instead of silently overwriting history.
- Summary injection uses pinned and high-value entries only, not raw full notebooks.
- UI landing points in v1:
  - workspace sidepanel section
  - project or environment management surface
