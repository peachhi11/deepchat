import type {
  IFilePresenter,
  ILlmProviderPresenter,
  IWindowPresenter,
  IYoBrowserPresenter
} from '@shared/presenter'
import type {
  DeepChatSubagentMeta,
  DeepChatSubagentSlot,
  MemoryKind,
  MemoryScope,
  PermissionMode,
  RunCheckpointType,
  RunSnapshot,
  SendMessageInput,
  SessionGenerationSettings,
  SessionKind
} from '@shared/types/agent-interface'
import type { ISkillPresenter } from '@shared/types/skill'
import type { DeepChatInternalSessionUpdate } from '../agentRuntimePresenter/internalSessionEvents'

export interface ConversationSessionInfo {
  sessionId: string
  agentId: string
  agentName: string
  agentType: 'deepchat' | 'acp' | null
  providerId: string
  modelId: string
  projectDir: string | null
  permissionMode: PermissionMode
  generationSettings: SessionGenerationSettings | null
  disabledAgentTools: string[]
  activeSkills: string[]
  sessionKind: SessionKind
  parentSessionId: string | null
  subagentEnabled: boolean
  subagentMeta: DeepChatSubagentMeta | null
  availableSubagentSlots: DeepChatSubagentSlot[]
}

export interface CreateSubagentSessionInput {
  parentSessionId: string
  agentId: string
  slotId: string
  displayName: string
  targetAgentId?: string | null
  projectDir?: string | null
  providerId: string
  modelId: string
  permissionMode: PermissionMode
  generationSettings?: Partial<SessionGenerationSettings>
  disabledAgentTools?: string[]
  activeSkills?: string[]
}

export type RuntimeContextSection = 'run' | 'memory' | 'handoff'

export interface RuntimeContextMemoryItem {
  id: string
  scope: MemoryScope
  kind: MemoryKind
  summary: string
  payloadUri: string | null
  createdAt: number
}

export interface RuntimeContextHandoff {
  checkpointId: string
  checkpointType: RunCheckpointType
  label: string
  markdown: string | null
  createdAt: number
}

export interface RuntimeContextReadResult {
  sessionId: string
  snapshot: RunSnapshot | null
  memories: RuntimeContextMemoryItem[]
  handoff: RuntimeContextHandoff | null
}

export interface AgentToolRuntimePort {
  resolveConversationWorkdir(conversationId: string): Promise<string | null>
  resolveConversationSessionInfo(conversationId: string): Promise<ConversationSessionInfo | null>
  readRuntimeContext?(
    conversationId: string,
    options?: {
      sections?: RuntimeContextSection[]
      memoryLimit?: number
    }
  ): Promise<RuntimeContextReadResult>
  createSubagentSession(input: CreateSubagentSessionInput): Promise<ConversationSessionInfo | null>
  sendConversationMessage(conversationId: string, content: string | SendMessageInput): Promise<void>
  cancelConversation(conversationId: string): Promise<void>
  subscribeDeepChatSessionUpdates(
    listener: (update: DeepChatInternalSessionUpdate) => void
  ): () => void
  getSkillPresenter(): ISkillPresenter
  getYoBrowserToolHandler(): IYoBrowserPresenter['toolHandler']
  getFilePresenter(): Pick<IFilePresenter, 'getMimeType' | 'prepareFileCompletely'>
  getLlmProviderPresenter(): Pick<
    ILlmProviderPresenter,
    'executeWithRateLimit' | 'generateCompletionStandalone'
  >
  createSettingsWindow(): ReturnType<IWindowPresenter['createSettingsWindow']>
  sendToWindow(
    windowId: number,
    channel: string,
    ...args: unknown[]
  ): ReturnType<IWindowPresenter['sendToWindow']>
  getApprovedFilePaths(conversationId: string): string[]
  consumeSettingsApproval(conversationId: string, toolName: string): boolean
}
