# Permission Approval Productization

## Summary

Productize the existing DeepChat permission flow so users can understand risk, remember approvals intentionally, and inspect or revoke active approvals. This spec builds on the existing pause/resume stabilization work without changing the underlying execution-gating semantics.

## Background

DeepChat already has real permission infrastructure in the main process:

- command permission cache with one-time and session scopes
- file permission approvals
- settings permission approvals
- permission payloads that already carry `rememberable`, `commandSignature`, and `commandInfo.riskLevel`

The current chat overlay does not expose most of that capability. In practice, users still see a binary allow/deny experience, incomplete risk visibility, and no approval inspection or revocation surface. That makes the system feel less reliable than the runtime actually is.

This spec separates “permission semantics and resume correctness” from “permission product experience”. The former remains defined by the existing stabilization spec. This document defines how the runtime becomes explainable and manageable to the user.

## Goals

- Show meaningful permission context to the user before they approve.
- Support explicit remember scopes where the runtime already has a sound implementation path.
- Provide a way to inspect and revoke active approvals in the current session.
- Keep permission handling compatible with the current parent/child session bridge.
- Preserve the existing execution pause/resume model.

## Non-Goals

- New permission types beyond `read`, `write`, `all`, and `command`.
- Cross-session, cross-device, or cloud-synced approval storage.
- Replacing the existing permission stabilization spec.
- Full policy language for arbitrary approval rules in v1.
- A new global settings page dedicated solely to permissions.

## Acceptance Criteria

- Permission requests in chat show:
  - tool name
  - formatted arguments when available
  - permission description
  - command risk details when the payload contains `commandInfo`
  - relevant target paths when the payload contains file paths
- Commands support the following scopes when the payload is rememberable:
  - `once`
  - `session`
  - `command_prefix`
- File and settings approvals support:
  - `once`
  - `session`
- If a scope is not valid for the current permission type, the renderer does not offer it.
- Users can inspect currently approved items for the active session and revoke them without restarting the session.
- Deny remains available for every permission request.
- Parent-session overlays continue to handle child-session permissions without opening a separate child approval flow.
- Pause/resume semantics, batch handling, and tool-result visibility continue to be governed by the existing permission stabilization behavior.

## Constraints

- The productized flow must reuse current permission services where possible.
- Approval storage remains session-scoped in v1.
- High-risk command approvals must never silently expand into broader scopes than the user explicitly chose.
- The feature must remain compatible with remote interaction adapters, even if those surfaces lag behind renderer parity.

## Compatibility / Migration

- No database migration is required in v1.
- Existing runtime caches continue to work. New scopes may require cache structure extensions but must not break current approvals.
- Existing overlay interactions remain valid. Older allow/deny responses should continue to work as `once` approvals.

## Default Decisions

- Command approvals expose risk level and suggestion from `commandInfo`.
- `command_prefix` is command-only and never shown for file or settings permissions.
- Approval management is session-scoped in v1.
- This feature lives in its own spec folder and does not modify the scope of `permission-flow-stabilization`.
