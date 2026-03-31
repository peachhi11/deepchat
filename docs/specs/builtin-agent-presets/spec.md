# Builtin Agent Presets

## Summary

Add dedicated builtin DeepChat agent presets for `review`, `compact-continue`, and `architect`. These presets are implemented as builtin prompt and agent assets on top of the existing DeepChat runtime and agent repository, not as fixed UI entry buttons and not as a second execution system.

## Background

DeepChat already has the building blocks for preset-driven agent behavior:

- a builtin protected DeepChat agent in the agent repository
- merged DeepChat agent config resolution
- configurable system prompts
- session-level model and tool policy controls

High-value workflows like code review, compaction continuation, and planning still depend on ad hoc prompting. That makes behavior inconsistent, hard to test, and hard to explain. The product goal is not to add a toolbar full of workflow buttons. The goal is to ship stable agent identities with known prompts, tool policies, and output contracts.

## Goals

- Ship stable builtin DeepChat presets for:
  - `review`
  - `compact-continue`
  - `architect`
- Keep preset execution inside the current DeepChat runtime.
- Allow presets to be selected the same way other DeepChat agents are selected or created.
- Define fixed prompt assets, default model preferences, and tool policy defaults per preset.
- Keep the feature compatible with existing DeepChat agent config inheritance.

## Non-Goals

- Fixed workflow entry buttons in the chat UI.
- A second runtime or second loop just for preset agents.
- Arbitrary user-authored preset scripting in v1.
- ACP preset behavior changes.
- Replacing general-purpose DeepChat sessions.

## Acceptance Criteria

- The repository can expose protected builtin DeepChat agents for:
  - `deepchat-review`
  - `deepchat-compact-continue`
  - `deepchat-architect`
- Each preset defines:
  - a stable builtin identity
  - a fixed prompt asset
  - default tool-policy constraints
  - optional default model preference overrides
- `review` is read-focused and cannot modify files by default.
- `architect` is planning-focused and does not modify files by default.
- `compact-continue` is continuation-focused and works with the existing compaction model instead of inventing a second compaction system.
- Presets appear through the existing agent selection flow, not through mandatory fixed entry buttons.
- Sessions created from preset agents still use the DeepChat loop, tool presenter, permission flow, and renderer surfaces.

## Constraints

- Presets must remain compatible with builtin-agent config merging.
- Prompt assets must be versioned inside the app, not hidden in user-editable prompt state.
- Tool policy must be enforced through existing DeepChat config and tool filtering mechanisms.
- Presets must not silently escalate permission mode.

## Compatibility / Migration

- No database migration is required in v1 if builtin preset identity is represented by protected builtin agent IDs.
- Existing general DeepChat sessions remain unchanged.
- User-created agents continue to inherit from the builtin base agent as before.

## Default Decisions

- Preset identity is modeled as protected builtin DeepChat agent IDs rather than a new runtime type.
- `review` disables file mutation tools by default.
- `architect` disables file mutation tools by default.
- `compact-continue` reuses the current compaction summary model and resume flow.
