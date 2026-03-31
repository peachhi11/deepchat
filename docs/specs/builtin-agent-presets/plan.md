# Builtin Agent Presets Plan

## Key Decisions

1. Represent preset identity as protected builtin DeepChat agents instead of inventing a new session kind.
2. Keep `deepchat` as the general builtin agent and add separate builtin protected agents for specialized presets.
3. Store preset prompts as app-bundled assets rather than user-editable system prompt entries.
4. Enforce preset behavior with existing DeepChat config fields such as system prompt, disabled tools, and default model preset.
5. Preserve current agent config merge behavior so builtin preset agents can override the general builtin base.

## Preset Definitions

### `deepchat-review`

- Purpose: review-oriented code analysis and risk finding
- Default tool policy: no `write` or `edit`; no settings mutation; subagent use disabled by default
- Expected output: findings-first review structure

### `deepchat-compact-continue`

- Purpose: continue work cleanly after compaction or summary-heavy sessions
- Default tool policy: same as general DeepChat unless explicitly restricted
- Expected output: concise continuation state and next-step execution

### `deepchat-architect`

- Purpose: planning, decomposition, and implementation design
- Default tool policy: no `write` or `edit`; question tool allowed; subagent use disabled by default
- Expected output: implementation plans and design decisions, not direct code mutation

## Main Process Changes

1. Extend builtin-agent initialization to register the three new protected DeepChat agents.
2. Add bundled prompt assets for each preset.
3. Resolve preset config through the existing agent repository merge flow:
   - base builtin `deepchat` config
   - preset-specific override config
4. Reuse current DeepChat session creation and session model resolution without a new runtime branch.

## Renderer Changes

1. Preset agents appear in existing agent selection and settings surfaces.
2. No fixed top-level workflow buttons are added in this feature.
3. Existing model and generation setting controls continue to work, but preset defaults provide initial values.

## Prompt and Policy Assembly

1. Prompt assets live outside mutable user system-prompt storage.
2. The runtime injects the preset prompt through the same DeepChat system prompt assembly path.
3. Tool restrictions are expressed through preset config defaults, especially `disabledAgentTools`.
4. The output contract is documented in the preset prompt itself, not encoded in renderer-only logic.

## Test Plan

- Builtin preset agents are present after initialization.
- Sessions created from preset agents resolve the expected config.
- `review` and `architect` do not expose file-mutation tools by default.
- `compact-continue` sessions still use the current compaction summary state and resume flow.
- Selecting a preset agent does not fork execution into a different runtime path.
- User-created agents still inherit from the builtin base agent correctly.

## Risks and Mitigations

- Risk: preset prompts drift from the general DeepChat prompt semantics.
  Mitigation: keep prompt assets small, versioned, and reviewed alongside config defaults.
- Risk: preset agents feel like hidden workflow buttons with no transparency.
  Mitigation: expose them as normal builtin agents with explicit names and descriptions.
- Risk: preset restrictions are bypassed by config merge behavior.
  Mitigation: define clear override order and test final resolved configs, not just stored inputs.
