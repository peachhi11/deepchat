# Compaction Hardening 规格

## Background

DeepChat already has working auto-compaction and persisted summary state. That is a strong base. The remaining gap is not the existence of compaction, but the quality and precision of what gets preserved or dropped.

Two improvements are needed:

1. richer full compaction handoff quality
2. lighter micro-compaction for stale tool-heavy noise

The goal is to preserve task-critical state more reliably without turning compaction into a second chat system.

## Goals

- Harden the full compaction prompt so it preserves the right state more consistently.
- Add micro-compaction for low-value tool-result noise.
- Keep current compaction safety properties such as summary redaction and resume compatibility.
- Reduce prompt drift after long sessions and tool-heavy work.

## Non-goals

- Replacing the current compaction runtime
- Exposing model scratchpad content to the user
- Building a second persistent summary database
- Compaction of arbitrary external logs or files outside the session context

## Acceptance Criteria

- Full compaction preserves:
  - timeline
  - touched files
  - important functions/types/commands
  - user feedback
  - failed attempts
  - outstanding tasks
- Micro-compaction can remove stale low-value tool output from active context building without rewriting the whole session summary.
- Existing compaction UI and persisted summary model remain compatible.
- Secret redaction and untrusted-summary handling still apply.

## Constraints

- Full compaction remains the only persisted summary handoff in v1.
- Micro-compaction is contextual pruning, not a second persisted summary lane.
- Current resume and compaction message behavior should not regress.

## Compatibility / Migration

- Additive only. Existing compaction-enabled agents remain valid.
- Existing stored summaries remain readable.
- No data migration is required for v1 micro-compaction support.

## Default Decisions

- Keep the current persisted-summary architecture.
- Add micro-compaction as prompt-time pruning rather than a second stored-summary format.
- Prefer preserving semantic task continuity over preserving raw tool transcript volume.
