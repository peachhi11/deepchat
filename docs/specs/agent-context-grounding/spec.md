# Agent Context Grounding

## Summary

Introduce a cache-friendly grounding layer for DeepChat agent sessions. The new layer must improve first-turn accuracy and repository awareness without collapsing prompt cache hit rate. It replaces the current single `systemEnvPromptBuilder` output with layered context, lazy instruction hydration, and explicit rules for when volatile repository state may enter the prompt.

## Background

Current DeepChat grounding is intentionally light. The system prompt builder already includes model identity, workdir, git-repo detection, platform, date, and root `AGENTS.md` content. That keeps prompt churn low, but it also means the agent starts many sessions with weak repository context and must rediscover the same README, folder layout, and local instructions through tools.

The reference Claude Code design shows that stronger startup grounding improves reliability, but its snapshot-heavy style would hurt DeepChat cache behavior if copied directly. `git status`, directory trees, and nested instruction files are especially volatile. This spec defines a layered grounding model that borrows the useful parts while preserving prompt stability as a hard constraint.

## Goals

- Provide stable repository grounding before the first tool call.
- Keep prompt cache hit rate as a hard product constraint.
- Surface local instructions beyond the root `AGENTS.md` without injecting all nested files into every turn.
- Support on-demand enrichment for `review`, explicit repository questions, and first-turn work in unfamiliar projects.
- Keep the design compatible with the current DeepChat main loop and prompt assembly order.

## Non-Goals

- Full repository indexing or semantic codebase search.
- Injecting raw `git status` or full directory trees into every turn.
- Replacing existing history compaction or message context selection.
- Rebuilding the prompt pipeline around a terminal-first runtime.
- Persisting repository snapshots to a new database table in v1.

## Acceptance Criteria

- Sessions with a `projectDir` build grounding from four conceptual sources:
  - stable environment facts
  - repository profile
  - instruction index
  - optional volatile enrichments
- Stable grounding always includes:
  - base environment information
  - root `AGENTS.md` when present
  - a `README.md` summary when present
  - lightweight repository profile facts such as git-repo presence and top-level technology hints
- Nested `AGENTS.md` and `CLAUDE.md` files are not injected as full text by default. The system first records their locations and only hydrates matching files when the agent is operating inside the relevant subtree or explicitly asks for them.
- `git status` and shallow directory tree details are excluded from the per-turn stable system prompt. They are injected only for:
  - the first turn of a new session when explicitly enabled by the grounding policy
  - `review`-style preset sessions
  - explicit user requests about repository state
  - targeted recovery flows that require current repository state
- Prompt assembly remains deterministic. Given the same day, project path, root instructions, README summary, and stable repository profile, the stable grounding section must remain byte-for-byte identical.
- Missing files are non-fatal. The grounding builder degrades cleanly when `README.md`, root `AGENTS.md`, or nested instruction files do not exist.

## Constraints

- Cache hit rate is a hard constraint. Volatile repository state must not enter the default per-turn system prompt.
- Grounding must remain compatible with the current prompt assembly flow in `DeepChatAgentPresenter`.
- Grounding must not require a new renderer surface in v1.
- The feature must work for both regular sessions and parent sessions that spawn subagents.
- The design must prefer shallow repository inspection and explicit lazy loads over eager full-project traversal.

## Compatibility / Migration

- No database migration is required in v1.
- Existing sessions continue to work without rehydration or backfill.
- The new grounding builder replaces the current environment builder behavior incrementally rather than introducing a second prompt runtime.

## Default Decisions

- Stable layer: environment facts, root `AGENTS.md`, `README.md` summary, lightweight repository profile.
- Indexed but not hydrated by default: nested `AGENTS.md` and `CLAUDE.md`.
- Volatile by default: `git status`, shallow directory tree text, local instruction file bodies outside the active subtree.
- First implementation target: DeepChat regular sessions. ACP sessions are out of scope unless they already reuse the same grounding assembly path.
