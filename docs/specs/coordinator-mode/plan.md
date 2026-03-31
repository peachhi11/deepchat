# Coordinator Mode 计划

## Key Decisions

1. Implement coordinator as a builtin preset `deepchat-coordinator`.
2. Reuse the current `subagent_orchestrator` and child-session runtime rather than creating a second worker engine.
3. Add managed scratchpad tools for coordinator runs instead of bypassing normal file permissions for arbitrary paths.
4. Keep worker control single-level in v1.

## Runtime Shape

### Coordinator Identity

- Add `deepchat-coordinator` to builtin preset definitions.
- Default tool policy:
  - `subagent_orchestrator` enabled
  - scratchpad tools enabled
  - direct write/edit tools allowed only if the selected worker profile allows them
- Default output contract:
  - plan tasks
  - dispatch workers
  - collect results
  - synthesize one final answer

### Scratchpad

- Create a run-scoped managed scratchpad namespace:
  - preferred path: `<projectDir>/.deepchat/scratchpads/<runId>/`
  - fallback when no project: app-managed userData scratchpad path
- Add managed tools:
  - `coordination_scratchpad_write`
  - `coordination_scratchpad_read`
  - `coordination_scratchpad_list`
- These tools operate only within the current run namespace and do not expose arbitrary path access.

### Worker Dispatch

- Coordinator dispatches work through the existing `subagent_orchestrator`.
- Workers still derive from configured slots and capability profiles.
- Worker prompts include:
  - task
  - expected output
  - scratchpad reference
  - whether they should read from prior worker notes

## Main / Shared / Renderer Changes

### Main

- Extend builtin preset assembly to include `deepchat-coordinator`.
- Add scratchpad service in the agent/tool layer with run-scoped storage lifecycle.
- Pass coordinator run metadata into worker handoff generation.

### Shared

- Add:
  - `builtinPresetId: 'deepchat-coordinator'`
  - `CoordinatorRunMeta`
  - `CoordinatorScratchpadEntry`

### Renderer

- Reuse existing subagent UI for worker visibility.
- No new workflow builder UI in v1.
- When helpful, show a lightweight label that a session is using the coordinator preset.

## Failure Modes

- Scratchpad unavailable:
  - coordinator continues without shared notes and records the failure in synthesis.
- Worker error:
  - coordinator can continue with remaining workers and include partial synthesis.
- Permission pause:
  - existing parent overlay flow remains the only interaction surface.
- Run cancellation:
  - cancel active workers and leave scratchpad content for traceability until cleanup.

## Test Plan

- Coordinator preset is created and selectable as a builtin preset.
- Coordinator can spawn workers through the existing orchestrator without changing child-session visibility.
- Scratchpad tools are limited to the current run namespace.
- Worker profiles still block restricted tools under coordinator dispatch.
- Parent permission and question bridge still works for worker interactions.
- Cancelled runs stop workers and prevent further scratchpad writes.

## Risk Mitigation

- Risk: coordinator turns into a second orchestration engine.
  Mitigation: reuse existing `subagent_orchestrator` and child-session model.
- Risk: scratchpad becomes a permission bypass for normal files.
  Mitigation: use managed scratchpad tools with strict path scoping.
- Risk: coordinator overuses executor workers.
  Mitigation: preset policy and prompt bias start from read-only workers first.
