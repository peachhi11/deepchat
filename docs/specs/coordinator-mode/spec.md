# Coordinator Mode 规格

## Background

DeepChat already has a strong subagent foundation:

- real child sessions
- `subagent_orchestrator`
- parent-side permission and question bridging
- slot-based worker targeting

What it still lacks is a dedicated planning layer for complex tasks. Today, the parent model can call the orchestrator directly, but there is no stable coordinator identity that is explicitly responsible for decomposition, worker reuse, scratchpad management, and result synthesis.

The goal of this feature is to add that extra coordination layer without replacing the current child-session runtime.

## Goals

- Add a dedicated coordinator mode on top of the existing DeepChat runtime.
- Keep worker execution on the current real child-session model.
- Make multi-agent behavior more predictable for large tasks such as repo review, implementation planning, and multi-step coding work.
- Provide a shared run-scoped scratchpad for coordinator and workers.
- Keep coordinator behavior compatible with capability profiles and permission policy.

## Non-goals

- Replacing `subagent_orchestrator`
- Building a separate workflow engine outside DeepChat runtime
- Allowing arbitrary repo writes through the shared scratchpad
- Supporting multi-level worker trees in v1
- Adding a full visual workflow builder UI

## Acceptance Criteria

- A builtin DeepChat preset named `deepchat-coordinator` exists.
- The coordinator can decompose a request into worker tasks and dispatch them through the existing subagent stack.
- Worker sessions remain real child sessions and stay visible through the current workspace/subagent surfaces.
- Coordinator and workers can exchange intermediate notes through a managed shared scratchpad for the run.
- Scratchpad access does not require normal file permission prompts, but it is restricted to managed scratchpad scope only.
- Capability profiles still constrain workers even when they are launched by the coordinator.
- Final answers are synthesized by the coordinator from worker results instead of exposing raw partial worker chatter to the parent loop.

## Constraints

- Coordinator is available only for DeepChat regular sessions.
- Coordinator remains single-level: coordinator -> workers only.
- Scratchpad storage must be run-scoped and isolated from arbitrary workspace files.
- Worker execution still uses the current permission, pending-input, and pause/resume semantics.
- Existing sessions and unconfigured agents must continue to work without coordinator mode enabled.

## Compatibility / Migration

- Additive only. Existing agents and sessions remain valid.
- Existing `subagent_orchestrator` behavior remains unchanged when coordinator mode is not used.
- Existing subagent slots and capability profiles continue to work; coordinator only adds a stable orchestration identity above them.

## Default Decisions

- Coordinator is implemented as a builtin DeepChat preset, not as a second runtime.
- Coordinator uses managed scratchpad storage rather than unrestricted workspace file sharing.
- Coordinator defaults to read-heavy worker strategies first and escalates to executor workers only when needed.
- Coordinator is planned as a reliability enhancement, not a replacement for direct single-agent operation.
