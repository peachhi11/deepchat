import { describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const passthrough = (name: string) =>
  defineComponent({
    name,
    template: '<div><slot /></div>'
  })

const buildAssistantMessage = (content: unknown) => ({
  id: 'm1',
  sessionId: 's1',
  orderSeq: 1,
  role: 'assistant' as const,
  content: JSON.stringify(content),
  status: 'sent' as const,
  isContextEdge: 0,
  metadata: JSON.stringify({
    model: 'dimcode-acp',
    provider: 'acp',
    reasoningStartTime: 1_200,
    reasoningEndTime: 4_500
  }),
  traceCount: 0,
  createdAt: 1,
  updatedAt: 1
})

type SetupOptions = {
  messages?: Array<Record<string, unknown>>
  initialRunSnapshot?: Record<string, unknown> | null
  isStreaming?: boolean
  streamingBlocks?: unknown[]
  currentStreamMessageId?: string | null
  pendingInputStorePatch?: Record<string, unknown>
  sessionKind?: 'regular' | 'subagent'
  spotlightPendingJump?: { sessionId: string; messageId: string } | null
}

const setup = async (options: SetupOptions = {}) => {
  vi.resetModules()

  const sessionStore = reactive({
    activeSession: {
      id: 's1',
      title: 'Session',
      projectDir: 'C:/repo',
      providerId: 'acp',
      modelId: 'dimcode-acp',
      status: 'idle',
      sessionKind: options.sessionKind ?? 'regular'
    },
    sendMessage: vi.fn().mockResolvedValue(undefined),
    fetchSessions: vi.fn().mockResolvedValue(undefined),
    selectSession: vi.fn().mockResolvedValue(undefined)
  })

  const messageStore = reactive({
    messages: options.messages ?? [
      buildAssistantMessage([
        {
          type: 'reasoning_content',
          content: 'thinking',
          status: 'success',
          timestamp: 1
        }
      ])
    ],
    isStreaming: options.isStreaming ?? false,
    streamingBlocks: options.streamingBlocks ?? [],
    currentStreamMessageId: options.currentStreamMessageId ?? null,
    loadMessages: vi.fn().mockResolvedValue(undefined),
    clearStreamingState: vi.fn(),
    addOptimisticUserMessage: vi.fn()
  })

  const pendingInputStore = reactive({
    items: [],
    steerItems: [],
    queueItems: [],
    isAtCapacity: false,
    loadPendingInputs: vi.fn().mockResolvedValue(undefined),
    queueInput: vi.fn().mockResolvedValue(undefined),
    updateQueueInput: vi.fn().mockResolvedValue(undefined),
    moveQueueInput: vi.fn().mockResolvedValue(undefined),
    convertToSteer: vi.fn().mockResolvedValue(undefined),
    deleteInput: vi.fn().mockResolvedValue(undefined),
    resumeQueue: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    ...options.pendingInputStorePatch
  })

  const modelStore = reactive({
    findModelByIdOrName: vi.fn((id: string) => ({
      model: {
        id,
        name: id === 'dimcode-acp' ? 'DimCode' : id
      }
    }))
  })

  const agentSessionPresenter = {
    getActiveRunSnapshot: vi.fn().mockResolvedValue(options.initialRunSnapshot ?? null),
    respondToolInteraction: vi.fn().mockResolvedValue(undefined),
    cancelGeneration: vi.fn().mockResolvedValue(undefined),
    retryMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    editUserMessage: vi.fn().mockResolvedValue(undefined),
    forkSession: vi.fn().mockResolvedValue({ id: 'forked' })
  }

  const spotlightStore = reactive({
    pendingMessageJump: options.spotlightPendingJump ?? null,
    clearPendingMessageJump: vi.fn(() => {
      spotlightStore.pendingMessageJump = null
    })
  })
  const listeners = new Map<string, Array<(...args: any[]) => void>>()

  vi.doMock('@/stores/ui/session', () => ({
    useSessionStore: () => sessionStore
  }))
  vi.doMock('@/stores/ui/message', () => ({
    useMessageStore: () => messageStore
  }))
  vi.doMock('@/stores/ui/pendingInput', () => ({
    usePendingInputStore: () => pendingInputStore
  }))
  vi.doMock('@/stores/modelStore', () => ({
    useModelStore: () => modelStore
  }))
  vi.doMock('@/composables/usePresenter', () => ({
    usePresenter: () => agentSessionPresenter
  }))
  vi.doMock('@/stores/ui/spotlight', () => ({
    useSpotlightStore: () => spotlightStore
  }))
  vi.doMock('vue-i18n', () => ({
    useI18n: () => ({
      t: (key: string) => key,
      locale: { value: 'zh-CN' }
    })
  }))
  vi.doMock('@shadcn/components/ui/tooltip', () => ({
    TooltipProvider: passthrough('TooltipProvider')
  }))
  vi.doMock('@/components/chat/ChatTopBar.vue', () => ({
    default: defineComponent({
      name: 'ChatTopBar',
      props: {
        isReadOnly: {
          type: Boolean,
          default: false
        }
      },
      template: '<div class="chat-top-bar-stub" :data-read-only="String(isReadOnly)" />'
    })
  }))
  vi.doMock('@/components/chat/MessageList.vue', () => ({
    default: defineComponent({
      name: 'MessageList',
      props: {
        messages: {
          type: Array,
          required: true
        },
        conversationId: {
          type: String,
          default: ''
        },
        ephemeralRateLimitBlock: {
          type: Object,
          default: null
        },
        ephemeralRateLimitMessageId: {
          type: String,
          default: null
        },
        isGenerating: {
          type: Boolean,
          default: false
        },
        traceMessageIds: {
          type: Array,
          default: () => []
        },
        isReadOnly: {
          type: Boolean,
          default: false
        }
      },
      template:
        '<div class="message-list-stub" :data-read-only="String(isReadOnly)" :data-has-rate-limit="String(Boolean(ephemeralRateLimitBlock))"><div v-for="message in messages" :key="message.id" class="message-item-stub" :data-message-id="message.id" /></div>'
    })
  }))
  vi.doMock('@/components/chat/ChatInputBox.vue', () => ({
    default: defineComponent({
      name: 'ChatInputBox',
      props: {
        files: {
          type: Array,
          default: () => []
        },
        submitDisabled: {
          type: Boolean,
          default: false
        }
      },
      template: '<div class="chat-input-box-stub"><slot name="toolbar" /></div>'
    })
  }))
  vi.doMock('@/components/chat/ChatInputToolbar.vue', () => ({
    default: defineComponent({
      name: 'ChatInputToolbar',
      props: {
        isGenerating: {
          type: Boolean,
          default: false
        },
        hasInput: {
          type: Boolean,
          default: false
        },
        sendDisabled: {
          type: Boolean,
          default: false
        }
      },
      template: '<div class="chat-input-toolbar-stub" />'
    })
  }))
  vi.doMock('@/components/chat/PendingInputLane.vue', () => ({
    default: defineComponent({
      name: 'PendingInputLane',
      props: {
        showResumeQueue: {
          type: Boolean,
          default: false
        }
      },
      template: '<div class="pending-input-lane-stub" />'
    })
  }))
  vi.doMock('@/components/chat/ChatStatusBar.vue', () => ({
    default: passthrough('ChatStatusBar')
  }))
  vi.doMock('@/components/chat/ChatToolInteractionOverlay.vue', () => ({
    default: defineComponent({
      name: 'ChatToolInteractionOverlay',
      template: '<div class="chat-tool-interaction-overlay-stub" />'
    })
  }))
  vi.doMock('@/components/chat/ChatSearchBar.vue', () => ({
    default: defineComponent({
      name: 'ChatSearchBar',
      props: {
        modelValue: {
          type: String,
          default: ''
        },
        activeMatch: {
          type: Number,
          default: 0
        },
        totalMatches: {
          type: Number,
          default: 0
        }
      },
      emits: ['update:modelValue', 'previous', 'next', 'close'],
      setup(_, { expose }) {
        expose({
          focusInput: vi.fn(),
          selectInput: vi.fn()
        })
      },
      template:
        '<div class="chat-search-bar-stub" :data-active-match="String(activeMatch)" :data-total-matches="String(totalMatches)" />'
    })
  }))
  vi.doMock('@/components/trace/TraceDialog.vue', () => ({
    default: passthrough('TraceDialog')
  }))
  ;(window as any).electron = {
    ipcRenderer: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        const handlers = listeners.get(event) ?? []
        handlers.push(handler)
        listeners.set(event, handlers)
      }),
      removeListener: vi.fn((event: string, handler: (...args: any[]) => void) => {
        const handlers = listeners.get(event) ?? []
        listeners.set(
          event,
          handlers.filter((candidate) => candidate !== handler)
        )
      })
    }
  }

  const ChatPage = (await import('@/pages/ChatPage.vue')).default
  const { SESSION_EVENTS } = await import('@/events')
  const wrapper = mount(ChatPage, {
    props: {
      sessionId: 's1'
    }
  })

  await flushPromises()

  return {
    wrapper,
    agentSessionPresenter,
    messageStore,
    pendingInputStore,
    spotlightStore,
    emitIpc: (event: string, payload?: unknown) => {
      for (const handler of listeners.get(event) ?? []) {
        handler(undefined, payload)
      }
    },
    SESSION_EVENTS
  }
}

describe('ChatPage', () => {
  it('maps reasoning metadata into message usage for think duration fallback', async () => {
    const { wrapper, messageStore } = await setup()

    expect(messageStore.loadMessages).toHaveBeenCalledWith('s1')

    const messageList = wrapper.findComponent({ name: 'MessageList' })
    const messages = messageList.props('messages') as Array<{
      usage: { reasoning_start_time: number; reasoning_end_time: number }
    }>

    expect(messages).toHaveLength(1)
    expect(messages[0].usage.reasoning_start_time).toBe(1_200)
    expect(messages[0].usage.reasoning_end_time).toBe(4_500)
  })

  it('extracts ephemeral rate-limit streaming blocks instead of creating a virtual assistant message', async () => {
    const { wrapper } = await setup({
      messages: [],
      isStreaming: true,
      currentStreamMessageId: '__rate_limit__:s1:1',
      streamingBlocks: [
        {
          type: 'action',
          action_type: 'rate_limit',
          status: 'pending',
          timestamp: 1
        }
      ]
    })

    const messageList = wrapper.findComponent({ name: 'MessageList' })
    expect(messageList.props('messages')).toEqual([])
    expect(messageList.props('ephemeralRateLimitMessageId')).toBe('__rate_limit__:s1:1')
    expect(messageList.props('ephemeralRateLimitBlock')).toEqual(
      expect.objectContaining({
        action_type: 'rate_limit'
      })
    )
    expect(wrapper.find('.message-list-stub').attributes('data-has-rate-limit')).toBe('true')
  })

  it('renders the run ticker when an active run snapshot is available', async () => {
    const { wrapper, agentSessionPresenter } = await setup({
      initialRunSnapshot: {
        runId: 'run-1',
        sessionId: 's1',
        title: 'Implement run ticker',
        goal: 'Implement run ticker',
        status: 'ready',
        stage: 'verify',
        progressDone: 0,
        progressTotal: 0,
        tickerSummary: 'Implement run ticker',
        completionAcknowledged: false,
        updatedAt: 1
      }
    })

    expect(agentSessionPresenter.getActiveRunSnapshot).toHaveBeenCalledWith('s1')
    expect(wrapper.find('[data-run-ticker="compact"]').exists()).toBe(true)
    expect(wrapper.find('[data-run-status="ready"]').exists()).toBe(true)
  })

  it('dismisses the compact run ticker after clicking the check island', async () => {
    const { wrapper } = await setup({
      initialRunSnapshot: {
        runId: 'run-1',
        sessionId: 's1',
        title: 'Implement run ticker',
        goal: 'Implement run ticker',
        status: 'ready',
        stage: 'verify',
        progressDone: 0,
        progressTotal: 0,
        tickerSummary: 'Implement run ticker',
        completionAcknowledged: false,
        updatedAt: 1
      }
    })

    await wrapper.get('button[data-run-ticker="compact"]').trigger('click')

    expect(wrapper.find('[data-run-ticker="compact"]').exists()).toBe(false)
  })

  it('updates the run ticker when a run snapshot IPC event arrives', async () => {
    const { wrapper, emitIpc, SESSION_EVENTS } = await setup()

    emitIpc(SESSION_EVENTS.RUN_SNAPSHOT_UPDATED, {
      sessionId: 's1',
      snapshot: {
        runId: 'run-2',
        sessionId: 's1',
        title: 'Handle permission wait',
        goal: 'Handle permission wait',
        status: 'executing',
        stage: 'task',
        progressDone: 0,
        progressTotal: 0,
        tickerSummary: 'Handle permission wait',
        completionAcknowledged: false,
        updatedAt: 2
      }
    })
    await flushPromises()

    expect(wrapper.find('[data-run-ticker="active"]').exists()).toBe(true)
    expect(wrapper.find('[data-run-status="executing"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Handle permission wait')
    expect(wrapper.text()).toContain('Task')
  })

  it('keeps pending lane visible below the tool interaction overlay', async () => {
    const { wrapper } = await setup({
      messages: [
        buildAssistantMessage([
          {
            type: 'action',
            action_type: 'question_request',
            status: 'pending',
            tool_call: {
              id: 'tool-1',
              name: 'question',
              params: '{}'
            }
          }
        ])
      ],
      pendingInputStorePatch: {
        items: [
          {
            id: 'p1',
            mode: 'queue',
            payload: { text: 'queued', files: [] }
          }
        ],
        queueItems: [
          {
            id: 'p1',
            mode: 'queue',
            payload: { text: 'queued', files: [] }
          }
        ]
      }
    })

    const html = wrapper.html()
    expect(wrapper.find('.chat-tool-interaction-overlay-stub').exists()).toBe(true)
    expect(wrapper.find('.pending-input-lane-stub').exists()).toBe(true)
    expect(wrapper.find('.chat-input-box-stub').exists()).toBe(false)
    expect(html.indexOf('chat-tool-interaction-overlay-stub')).toBeLessThan(
      html.indexOf('pending-input-lane-stub')
    )
  })

  it('renders pending lane above the input box when no tool interaction is active', async () => {
    const { wrapper } = await setup({
      pendingInputStorePatch: {
        items: [
          {
            id: 'p1',
            mode: 'queue',
            payload: { text: 'queued', files: [] }
          }
        ],
        queueItems: [
          {
            id: 'p1',
            mode: 'queue',
            payload: { text: 'queued', files: [] }
          }
        ]
      }
    })

    const html = wrapper.html()
    expect(wrapper.find('.pending-input-lane-stub').exists()).toBe(true)
    expect(wrapper.find('.chat-input-box-stub').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PendingInputLane' }).props('showResumeQueue')).toBe(true)
    expect(html.indexOf('pending-input-lane-stub')).toBeLessThan(
      html.indexOf('chat-input-box-stub')
    )
  })

  it('hides resume queue while waiting for a tool follow-up answer', async () => {
    const { wrapper } = await setup({
      messages: [
        buildAssistantMessage([
          {
            type: 'action',
            action_type: 'question_request',
            status: 'success',
            tool_call: {
              id: 'tool-1',
              name: 'question',
              params: '{}'
            },
            extra: {
              needsUserAction: false,
              questionResolution: 'replied'
            }
          }
        ])
      ],
      pendingInputStorePatch: {
        items: [
          {
            id: 'p1',
            mode: 'queue',
            payload: { text: 'queued', files: [] }
          }
        ],
        queueItems: [
          {
            id: 'p1',
            mode: 'queue',
            payload: { text: 'queued', files: [] }
          }
        ]
      }
    })

    expect(wrapper.findComponent({ name: 'PendingInputLane' }).props('showResumeQueue')).toBe(false)
  })

  it('allows queueing attachment-only drafts', async () => {
    const { wrapper, pendingInputStore } = await setup()
    const file = { name: 'a.txt', path: '/tmp/a.txt', mimeType: 'text/plain' }

    const inputBox = wrapper.findComponent({ name: 'ChatInputBox' })
    inputBox.vm.$emit('update:files', [file])
    await flushPromises()

    const toolbar = wrapper.findComponent({ name: 'ChatInputToolbar' })
    expect(toolbar.props('hasInput')).toBe(true)
    expect(toolbar.props('sendDisabled')).toBe(false)
    expect(inputBox.props('submitDisabled')).toBe(false)

    inputBox.vm.$emit('submit')
    await flushPromises()

    expect(pendingInputStore.queueInput).toHaveBeenCalledWith('s1', {
      text: '',
      files: [file]
    })
  })

  it('opens the inline search with Ctrl+F and closes it with Escape', async () => {
    const { wrapper } = await setup()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
    await flushPromises()
    expect(wrapper.find('.chat-search-bar-stub').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('.chat-search-bar-stub').exists()).toBe(false)
  })

  it('renders subagent sessions as read-only display mode', async () => {
    const { wrapper } = await setup({
      sessionKind: 'subagent',
      messages: [
        buildAssistantMessage([
          {
            type: 'action',
            action_type: 'question_request',
            status: 'pending',
            tool_call: {
              id: 'tool-1',
              name: 'question',
              params: '{}'
            }
          }
        ])
      ],
      pendingInputStorePatch: {
        queueItems: [
          {
            id: 'p1',
            mode: 'queue',
            payload: { text: 'queued', files: [] }
          }
        ]
      }
    })

    expect(wrapper.find('.chat-top-bar-stub').attributes('data-read-only')).toBe('true')
    expect(wrapper.find('.message-list-stub').attributes('data-read-only')).toBe('true')
    expect(wrapper.find('.chat-input-box-stub').exists()).toBe(false)
    expect(wrapper.find('.pending-input-lane-stub').exists()).toBe(false)
    expect(wrapper.find('.chat-tool-interaction-overlay-stub').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ChatStatusBar' }).exists()).toBe(false)
  })

  it('consumes pending spotlight message jumps after loading the target session', async () => {
    vi.useFakeTimers()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true
    })

    const { wrapper, spotlightStore } = await setup({
      spotlightPendingJump: {
        sessionId: 's1',
        messageId: 'm1'
      }
    })

    await flushPromises()

    expect(wrapper.find('[data-message-id="m1"]').classes()).toContain('message-highlight')
    expect(scrollIntoView).toHaveBeenCalled()
    expect(spotlightStore.clearPendingMessageJump).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
