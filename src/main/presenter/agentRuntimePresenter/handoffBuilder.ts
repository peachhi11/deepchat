import type { HarnessRun } from '@shared/types/agent-interface'
import type { SessionSummaryState } from './sessionStore'

type BuildRunHandoffInput = {
  run: HarnessRun
  summaryState: SessionSummaryState
  checkpointLabel: string
  source: 'before_compaction' | 'failure'
  nextStep: string
  errorMessage?: string
}

const formatSummaryTimestamp = (value: number | null): string =>
  typeof value === 'number' ? new Date(value).toISOString() : '(none)'

export function buildRunHandoffMarkdown(input: BuildRunHandoffInput): string {
  return [
    '# Structured Handoff',
    '',
    '## Current Goal',
    input.run.goal || input.run.title,
    '',
    '## Important State',
    `- Title: ${input.run.title}`,
    `- Status: ${input.run.status}`,
    `- Stage: ${input.run.stage}`,
    `- Checkpoint: ${input.checkpointLabel}`,
    `- Source: ${input.source}`,
    '',
    '## Persisted Summary State',
    `- Cursor Order: ${input.summaryState.summaryCursorOrderSeq}`,
    `- Summary Updated At: ${formatSummaryTimestamp(input.summaryState.summaryUpdatedAt)}`,
    input.summaryState.summaryText?.trim() || '(none)',
    '',
    '## Open Issues And Next Steps',
    `- Next step: ${input.nextStep}`,
    ...(input.errorMessage ? [`- Failure: ${input.errorMessage}`] : [])
  ].join('\n')
}
