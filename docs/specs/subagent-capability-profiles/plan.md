# Subagent Capability Profiles Plan

## Key Decisions

1. Extend slot config instead of adding per-task inline policy input.
2. Map capability profiles to tool filtering and session defaults before child session creation.
3. Keep permission and question bridging in the parent session exactly as it works today.
4. Default all existing slots to `executor` to avoid breaking current behavior.
5. Reuse the existing `disabledAgentTools` flow to enforce most restrictions.

## Shared Type Changes

Extend `DeepChatSubagentSlot` with:

- `capabilityProfile: 'read_only_scout' | 'reviewer' | 'executor'`

No new session kind is required.

## Profile Policy Matrix

### `read_only_scout`

- Allowed:
  - `read`
  - `find`
  - `grep`
  - `ls`
  - question tool
- Disabled:
  - `write`
  - `edit`
  - `exec`
  - `process`
  - settings tools
  - `subagent_orchestrator`

### `reviewer`

- Allowed:
  - read-only repository tools
  - question tool
  - `exec`
  - `process`
- Disabled:
  - `write`
  - `edit`
  - settings tools
  - `subagent_orchestrator`

### `executor`

- Allowed:
  - current default child-session tool surface
- Disabled:
  - none beyond the parent session’s own restrictions

## Main Process Changes

1. Normalize slot profiles in shared config normalization.
2. When the orchestrator creates a child session, derive the child’s disabled tool set from:
   - parent disabled tools
   - profile restrictions
3. Pass the filtered tool policy into child session creation.
4. Keep inherited project dir, model, permission mode, and generation settings unchanged unless profile rules say otherwise.

## Renderer Changes

1. Extend DeepChat agent settings so each slot can choose a capability profile.
2. Show profile labels in subagent settings and, when helpful, in workspace child-session summaries.
3. No new runtime control panel is required in v1.

## Test Plan

- Existing slots with no stored profile resolve to `executor`.
- `read_only_scout` child sessions never expose mutation or shell-exec tools.
- `reviewer` child sessions expose observation commands but not file mutation tools.
- `executor` child sessions preserve current behavior.
- Parent overlays still resolve child permissions and questions.
- Failed child sessions remain isolated and do not contaminate parent tool execution state.

## Risks and Mitigations

- Risk: profile restrictions and parent disabled tools conflict unpredictably.
  Mitigation: define child tool policy as parent restrictions plus profile restrictions, never profile overrides that remove parent restrictions.
- Risk: review tasks become too weak if `reviewer` is over-restricted.
  Mitigation: explicitly allow observation-oriented `exec` and `process` in `reviewer`.
- Risk: profile labels drift from actual tool policy.
  Mitigation: keep the policy matrix centralized in one mapping module and test resolved tool definitions.
