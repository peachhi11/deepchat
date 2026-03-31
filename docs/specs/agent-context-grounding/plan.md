# Agent Context Grounding Implementation Plan

## Key Decisions

1. Keep the current prompt pipeline shape. Replace the environment prompt internals rather than introducing a second prompt assembler.
2. Split grounding into stable and volatile layers. Only the stable layer is eligible for per-turn system prompt reuse.
3. Index nested instruction files early, but hydrate their contents lazily.
4. Treat `git status` and directory-tree text as on-demand enrichments, not default prompt material.
5. Reuse in-memory cache in the main process. Do not add a database cache in v1.

## Grounding Model

Introduce a grounding builder that produces a structured result:

- `stablePromptSection: string`
- `instructionIndex: Array<{ path: string; kind: 'AGENTS' | 'CLAUDE' }>`
- `repoProfile: { isGitRepo: boolean; readmePath?: string; techHints: string[] }`
- `volatileSections: { gitStatus?: string; directoryTree?: string; hydratedInstructions?: Array<{ path: string; content: string }> }`
- `fingerprint: string`
- `dayKey: string`

The stable prompt section is the only part that participates in the current per-session prompt cache. Volatile sections are resolved later and appended only when policy allows.

## Main Process Changes

1. Add a grounding builder near the current `systemEnvPromptBuilder`.
2. Move current root `AGENTS.md` handling into the new builder instead of keeping it as a special case.
3. Add shallow repository helpers for:
   - README discovery and summarization
   - top-level repository profile extraction
   - nested `AGENTS.md` / `CLAUDE.md` discovery
4. Keep volatile helpers separate:
   - `git status`
   - shallow directory tree rendering
   - nested instruction hydration
5. Extend the existing per-session system prompt cache key from simple day-based invalidation to a grounding fingerprint that includes:
   - normalized project path
   - current day key
   - root instruction file content hash
   - README summary hash
   - repository profile hash

## Prompt Assembly

1. `DeepChatAgentPresenter.buildSystemPromptWithSkills()` keeps its current high-level order.
2. The environment section becomes `stablePromptSection` from the new grounding builder.
3. Volatile enrichment is appended only when the session policy or preset requires it.
4. `review` preset sessions explicitly request volatile repository enrichment.
5. Normal chat turns use only the stable grounding unless the user request explicitly targets current repository state.

## Caching and Invalidation

1. Stable grounding cache is per session and keyed by grounding fingerprint.
2. README summary invalidates when the README file content changes.
3. Root `AGENTS.md` invalidates when the file content changes.
4. Nested instruction index invalidates when the set of discovered instruction files changes.
5. Volatile sections are never cached inside the stable prompt cache entry.

## Test Plan

- Builder returns stable output for a project with root `AGENTS.md`, `README.md`, and a git repo.
- Builder degrades cleanly when `README.md` or `AGENTS.md` is missing.
- Nested instruction files are indexed but not hydrated in the default stable prompt.
- Stable prompt remains unchanged across turns when only `git status` changes.
- `review` policy requests volatile repository enrichment without mutating the stable prompt cache key.
- Sessions outside a git repo still produce a valid grounding section.

## Risks and Mitigations

- Risk: README summaries become too large and reduce effective context.
  Mitigation: bound summary size and prefer concise structural summaries over raw excerpts.
- Risk: nested instruction discovery becomes expensive in large repositories.
  Mitigation: limit traversal depth in v1 and stop after a bounded number of matches.
- Risk: prompt assembly accidentally mixes volatile content into the stable cache entry.
  Mitigation: use distinct builder outputs and explicit append points for volatile sections.
