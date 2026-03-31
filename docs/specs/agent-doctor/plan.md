# Agent Doctor Plan

## Key Decisions

1. Aggregate existing service signals in one doctor model instead of scattering new checks across unrelated presenters.
2. Add a dedicated diagnostics aggregation layer in the main process because this feature spans multiple presenters and services.
3. Keep probes on-demand. Startup may prewarm only signals that already exist today.
4. Model checks and recovery actions explicitly so renderer surfaces stay simple and explainable.
5. Treat doctor as a separate implementation stream after the current reliability-first batch.

## Doctor Model

Define shared structures equivalent to:

- `DoctorCheckId`
- `DoctorCheckResult`
- `DoctorAction`
- `DoctorSessionRecoveryState`

Each check result includes:

- `id`
- `status: 'healthy' | 'warning' | 'error' | 'checking'`
- `summary`
- `detail`
- `actions`
- `checkedAt`

## Check Sources

### Runtime and Tooling

- Shell availability
- `rg` availability
- git availability
- workdir accessibility
- background exec session manager health

### Agent Runtime

- RTK runtime health
- pending input recovery state
- interrupted-message recovery state
- resume-path readiness for waiting assistant messages

### Integrations

- MCP server connectivity snapshot
- provider auth and required credential readiness

## Main Process Changes

1. Add a diagnostics aggregation presenter or equivalent main-process module.
2. Reuse existing service APIs where they already expose health or status data.
3. Add small adapters where a service has useful data but no doctor-friendly interface yet.
4. Expose one renderer-facing query API and one action API for recovery actions such as:
   - retry RTK health check
   - resume pending queue
   - open provider settings
   - reveal workspace path
   - refresh MCP connectivity state

## Renderer Changes

1. Add a doctor dialog or sheet with grouped checks and actions.
2. Reuse existing status styling rather than inventing a separate visual system.
3. Keep recovery actions explicit and safe; no hidden automatic mutation.

## Test Plan

- Shell / `rg` / git checks report correct states on success and failure paths.
- RTK health mirrors the existing RTK runtime service state.
- Pending queue and interrupted-session recovery states are surfaced when present.
- MCP connectivity failures show actionable detail instead of generic errors.
- Doctor actions call the correct main-process recovery paths.

## Risks and Mitigations

- Risk: diagnostics duplicate logic already implemented elsewhere.
  Mitigation: build adapters around existing services and keep them as the health source of truth.
- Risk: checks become too expensive and slow the app.
  Mitigation: keep heavyweight probes on-demand and cache recent results briefly.
- Risk: recovery actions mutate too much state automatically.
  Mitigation: limit v1 to safe, bounded actions such as retry, reopen, resume, and reveal.
