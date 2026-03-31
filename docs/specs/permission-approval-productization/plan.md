# Permission Approval Productization Plan

## Key Decisions

1. Extend the existing permission response payload rather than creating a second interaction channel.
2. Keep runtime approval services session-scoped in v1.
3. Expose only scopes that the runtime can enforce deterministically.
4. Reuse the current chat overlay as the approval entry point.
5. Add a lightweight approval manager surface reachable from chat controls instead of creating a full new settings page.

## Shared Type Changes

Update `ToolInteractionResponse` to support remembered approvals:

- `kind: 'permission'`
- `granted: boolean`
- `remember?: boolean`
- `approvalScope?: 'once' | 'session' | 'command_prefix'`

Keep existing question response types unchanged.

Normalize permission payloads so renderer-visible structures always include, when applicable:

- `requestId`
- `rememberable`
- `paths`
- `commandSignature`
- `commandInfo`

## Main Process Changes

1. Extend permission-response handling in `DeepChatAgentPresenter` so approvals can pass through the new scope metadata.
2. Extend command permission caching to support `command_prefix` approvals in addition to exact signature and session approvals.
3. Add list and revoke methods for:
   - command approvals
   - file approvals
   - settings approvals
4. Add session-scoped IPC endpoints that return current approval state and allow revocation.
5. Keep existing pause/resume and batch gating untouched. Only approval storage and renderer-facing metadata change in this feature.

## Renderer Changes

1. Upgrade `ChatToolInteractionOverlay` to show:
   - risk details
   - target paths
   - remember controls
   - scope controls when the permission type allows them
2. Add an approval-manager sheet or popover reachable from existing chat status controls.
3. Show active approvals grouped by permission type with revoke actions.
4. Keep the existing parent-session overlay behavior for child waiting states.

## Service Reuse Strategy

- `CommandPermissionService` remains the source of command approval truth.
- `FilePermissionService` remains the source of file-path approvals.
- `SettingsPermissionService` remains the source of settings approvals.
- New code adds list/revoke capabilities and broader scope handling where needed rather than replacing these services.

## Test Plan

- Overlay renders command risk details when `commandInfo` is present.
- `once` approvals are consumed exactly once.
- `session` approvals persist until the session ends or the user revokes them.
- `command_prefix` approvals allow matching commands and do not expand beyond the approved prefix.
- File approvals can be listed and revoked.
- Settings approvals can be listed and revoked.
- Parent-session overlay still resolves child permissions correctly.
- Existing allow/deny-only flows still work without scope metadata.

## Risks and Mitigations

- Risk: scope semantics diverge between command, file, and settings approvals.
  Mitigation: renderer only offers scopes that the active permission type can actually enforce.
- Risk: approval manager becomes stale relative to runtime state.
  Mitigation: query fresh approval state on open and refresh after every grant or revoke.
- Risk: command-prefix approval is overly broad.
  Mitigation: normalize and compare against a bounded prefix representation instead of raw command text.
