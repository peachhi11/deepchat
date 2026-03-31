# Subagent Capability Profiles

## Summary

Add slot-level capability profiles for DeepChat subagents so child sessions can be deliberately restricted by role. The goal is to keep the existing real child-session orchestration model while reducing accidental writes, unnecessary execution, and tool overexposure.

## Background

DeepChat already has a strong subagent model:

- real child sessions
- parent-child UI linkage
- parent overlay handling for child permissions and questions
- workspace-side visibility of child sessions

The current system still inherits most parent runtime behavior into children. That is powerful but risky. Many delegated subtasks only need repository reading or review behavior, yet they can still reach broader tool surfaces than necessary. This spec introduces named capability profiles so delegation becomes safer and more predictable.

## Goals

- Add slot-level capability profiles that constrain child behavior by role.
- Preserve the current `subagent_orchestrator` architecture and real child-session model.
- Keep parent-session permission and question bridging intact.
- Make read-only delegation the default for exploratory tasks.
- Define safe defaults for existing slots.

## Non-Goals

- Multi-level child-session trees.
- Per-task custom policy scripting in v1.
- Replacing the current subagent orchestrator tool.
- Independent child approval UIs.
- Dynamic profile learning or automatic profile inference in v1.

## Acceptance Criteria

- Every subagent slot can declare a `capabilityProfile`.
- V1 ships at least:
  - `read_only_scout`
  - `reviewer`
  - `executor`
- `read_only_scout` can read repository state but cannot mutate files, execute shell commands, modify settings, or spawn subagents.
- `reviewer` can inspect repository state and run observation-oriented commands, but cannot mutate files or settings.
- `executor` preserves the current child-session behavior, subject to the existing permission model.
- Parent overlays still handle child permission and question interactions.
- Existing slots without an explicit profile default to `executor` so current behavior is preserved after migration.

## Constraints

- Capability profiles must be enforced with existing DeepChat config and tool filtering primitives where possible.
- Profiles must not require a second child-session runtime.
- Child sessions must never override their assigned capability profile at runtime.
- Child sessions remain single-level children under the existing orchestrator.

## Compatibility / Migration

- Additive config change only. Existing slots default to `executor`.
- No change to existing parent-child session identity or workspace visibility.
- No change to the current `subagent_orchestrator` public tool name.

## Default Decisions

- Existing unprofiled slots migrate to `executor`.
- `read_only_scout` is the preferred profile for exploration and repository discovery.
- `reviewer` is the preferred profile for review tasks that may need command-line observation but not mutation.
- `executor` remains the only profile that can keep file-mutation tools in v1.
