# Agent Doctor

## Summary

Create a unified diagnostics and recovery surface for DeepChat agent runtime health. The doctor must turn opaque “agent feels unstable” reports into explicit checks, concrete failure reasons, and safe next actions.

## Background

DeepChat already contains many useful runtime signals:

- RTK health state
- background exec session management
- pending input recovery
- message recovery after interrupted sessions
- provider-specific auth and model configuration state
- workspace and git helpers

These capabilities are scattered across services and settings surfaces. Users see symptoms, but not a single explainable health view. This feature gathers those signals into one doctor model and adds recovery guidance for the most common blocked states.

## Goals

- Provide a single diagnostics surface for agent runtime health.
- Cover at least:
  - shell availability
  - `rg` availability
  - git availability
  - background exec health
  - MCP connectivity
  - provider auth readiness
  - RTK health
  - workdir permission readiness
- Surface recoverable session states:
  - pending inputs waiting for resume
  - interrupted or incomplete tool interactions
  - failed resume situations
- Provide concrete user-facing failure reasons and suggested actions.

## Non-Goals

- Automatic self-healing for destructive or risky operations.
- A cloud diagnostics backend.
- Replacing existing settings dashboards that already show stable configuration data.
- Remote-control-specific doctor surfaces in v1.
- Shipping this feature in the current implementation batch by default.

## Acceptance Criteria

- Doctor results are grouped into named checks with:
  - status
  - short reason
  - supporting detail
  - suggested next action
- The doctor can report session-level blocked states such as:
  - queued inputs not draining
  - interrupted background exec sessions
  - unfinished tool interaction recovery
- The doctor can distinguish configuration failures from runtime failures.
- The doctor does not require opening developer tools or reading logs to understand common failures.
- The doctor remains optional and does not block normal chat startup.

## Constraints

- The doctor must reuse existing runtime signals whenever possible.
- Health checks must remain bounded and safe.
- Expensive probes should be on-demand, not always-on at app startup.
- The design must coexist with current settings and chat surfaces rather than replacing them.

## Compatibility / Migration

- No database migration is required in v1 by default.
- Existing services remain the source of truth for their own health signals.
- The doctor feature is spec-only in the current planning batch and does not force immediate code rollout.

## Default Decisions

- Doctor is implemented as a separate feature, not bundled into the current reliability v1 implementation batch.
- RTK health is reused from the existing RTK runtime service rather than duplicated.
- Recovery actions focus on safe operations such as retry, reopen, resume, reveal, and recheck.
