import type { ChatMessage } from '@shared/types/core/chat-message'

export type PlannedRunIntent = {
  title: string
  goal: string
  acceptanceCriteria: string[]
  source: 'model' | 'fallback'
}

const GOAL_PLANNER_SYSTEM_PROMPT = [
  'You are DeepChat runtime planner.',
  'Rewrite the latest user request into a concise execution title, a concrete goal, and 1-4 acceptance criteria.',
  'If an active run already exists, preserve and refine that run instead of drifting to a vague "continue" goal.',
  'Return JSON only. Do not wrap in markdown fences.',
  'Schema:',
  '{"title":"string","goal":"string","acceptanceCriteria":["string"]}',
  'Rules:',
  '- title: under 72 chars, action-oriented, no trailing period',
  '- goal: concrete execution objective, not a copy of the user text unless necessary',
  '- acceptanceCriteria: short checklist items that define task completion'
].join('\n')

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() ?? ''

const extractJsonObject = (value: string): string | null => {
  const trimmed = value.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const match = trimmed.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

const clampTitle = (value: string, fallback: string): string => {
  const normalized = normalizeText(value) || fallback
  return normalized.slice(0, 72).trimEnd()
}

export function buildGoalPlannerMessages(params: {
  text: string
  projectDir?: string | null
  currentTitle?: string | null
  currentGoal?: string | null
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: GOAL_PLANNER_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: [
        `User request: ${params.text.trim() || '(empty)'}`,
        params.currentTitle ? `Active run title: ${params.currentTitle}` : '',
        params.currentGoal ? `Active run goal: ${params.currentGoal}` : '',
        params.projectDir ? `Project directory: ${params.projectDir}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    }
  ]
}

export function parsePlannedRunIntent(
  content: string,
  fallback: { title: string; goal: string }
): PlannedRunIntent {
  const jsonText = extractJsonObject(content)
  if (!jsonText) {
    return {
      title: fallback.title,
      goal: fallback.goal,
      acceptanceCriteria: [],
      source: 'fallback'
    }
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      title?: unknown
      goal?: unknown
      acceptanceCriteria?: unknown
    }

    const title = clampTitle(typeof parsed.title === 'string' ? parsed.title : '', fallback.title)
    const goal = normalizeText(typeof parsed.goal === 'string' ? parsed.goal : '') || fallback.goal
    const acceptanceCriteria = Array.isArray(parsed.acceptanceCriteria)
      ? parsed.acceptanceCriteria
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => normalizeText(entry))
          .filter(Boolean)
          .slice(0, 4)
      : []

    return {
      title,
      goal,
      acceptanceCriteria,
      source: 'model'
    }
  } catch {
    return {
      title: fallback.title,
      goal: fallback.goal,
      acceptanceCriteria: [],
      source: 'fallback'
    }
  }
}
