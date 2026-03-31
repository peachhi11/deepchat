# Global Memory Pool 规格

## Background

DeepChat needs a long-lived memory layer, but it does not need multiple overlapping memory systems.

The earlier `project-memory-notebook` direction was useful for defining safety principles, but it is still too product-heavy for the current goal. The updated direction is simpler:

- one global memory pool
- stored inside DeepChat-managed data
- organized by project and time
- driven by autonomy
- automatically merged, forgotten, and maintained

This pool should use the same DuckDB technology family already used by the built-in knowledge base, but it should not reuse the user-facing knowledge base schema or become another visible notebook product surface.

## Goals

- Add one global memory pool as the only long-term memory source for DeepChat.
- Group and rank memories by project and time.
- Let autonomy extract, merge, and forget memories automatically.
- Keep memory retrieval compact and relevant to the current project and request.
- Make the feature weakly visible rather than fully notebook-driven.

## Non-goals

- A full notebook sidepanel product
- `MEMORY.md` file-based memory
- Team memory sync
- Magic Docs
- Automatic business-code edits driven by memory jobs
- Multiple competing long-term memory stores

## Acceptance Criteria

- A DeepChat-managed memory database exists and is separate from user-configured knowledge bases.
- Every memory entry can be associated with a project key and time metadata.
- Turn-end autonomy can create memory candidates and persist accepted results automatically.
- Retrieval uses mixed ranking:
  - project/time/kind/importance filtering first
  - semantic ranking second
- Prompt injection remains compact and summary-based.
- Non-pinned memories can be merged, decayed, and forgotten automatically.
- The feature can be disabled globally per agent and per session.
- The user is not required to manage a large notebook UI to benefit from the system.

## Constraints

- The memory pool is internal DeepChat data, not a repo file.
- Memory writes must never modify business code or arbitrary workspace files.
- Prompt injection must stay cache-friendly and bounded.
- Memory visibility in v1 is weak:
  - brief summaries
  - recent changes
  - limited manage actions
- Pinned memories must be protected from automatic deletion.

## Compatibility / Migration

- This supersedes the earlier `project-memory-notebook` direction for implementation.
- Existing sessions, projects, and knowledge-base configs remain valid.
- No migration is required for repos that have never used notebook-style memory.
- Memory pool enablement is additive and can start empty.

## Default Decisions

- Use one global memory pool instead of project notebooks plus extra memory layers.
- Use DuckDB-backed storage in DeepChat data space.
- Use autonomy as the only writer/orchestrator of automatic memory maintenance.
- Default retrieval is mixed, not purely symbolic and not purely semantic.
- Automatic forgetting is allowed, but pinned entries are protected.
