# Compaction Hardening 计划

## Key Decisions

1. Keep current `CompactionService` as the only persisted summary path.
2. Strengthen the full compaction prompt instead of redesigning summary storage.
3. Implement micro-compaction as context-time pruning for stale tool-heavy blocks.
4. Preserve current redaction and untrusted-summary boundaries.

## Full Compaction

### Prompt Requirements

- Require the summary to retain:
  - chronological task flow
  - key file paths
  - important functions, classes, and type names
  - meaningful command outcomes
  - explicit user preferences and constraints
  - unresolved items
  - failed or rejected approaches

### Safety

- Keep existing summary sanitization and secret redaction.
- Keep summary content marked as untrusted conversation data.

## Micro-compaction

### Behavior

- Micro-compaction runs during context assembly.
- It targets stale low-value tool output first, especially:
  - oversized raw tool responses
  - repetitive read-only command dumps
  - old intermediate outputs that are no longer referenced by later turns

### Persistence

- Micro-compaction does not create a persisted summary message.
- Micro-compaction only changes what enters the active prompt window.

## Main / Shared / Renderer Changes

### Main

- Extend compaction prompt builder to support stricter full-summary instructions.
- Add a micro-compaction decision path in context building / tool-output selection.
- Reuse existing tool output guardrails where possible instead of introducing a parallel pruning system.

### Shared

- Add a small mode type where needed:
  - `compactionMode: 'full' | 'micro'`

### Renderer

- Keep existing full-compaction visual treatment.
- Do not add a separate visible micro-compaction lane in v1.

## Trigger Strategy

- Full compaction:
  - keep the existing threshold-based summary trigger
- Micro-compaction:
  - run before full compaction when prompt pressure is caused mainly by stale tool output
  - skip when the session is small or the candidate stale content is negligible

## Test Plan

- Full compaction summaries retain key files, commands, user feedback, and unresolved work.
- Secret-like values are still redacted from summaries.
- Micro-compaction removes stale tool noise without dropping active semantic state.
- Existing resume flow still works after full compaction.
- Sessions with no large stale tool output behave exactly as before.

## Risk Mitigation

- Risk: micro-compaction hides something important.
  Mitigation: prune only stale, low-value tool output and keep user/assistant semantic turns intact.
- Risk: full summaries become bloated.
  Mitigation: require high-signal fields but keep concise structured output expectations.
- Risk: new pruning logic diverges from tool-output guardrails.
  Mitigation: integrate with existing guard and context-selection logic where possible.
