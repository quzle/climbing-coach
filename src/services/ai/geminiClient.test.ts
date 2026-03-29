import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AthleteContext, ChatMessage } from '@/types'
import { buildAthleteContext } from '@/services/ai/contextBuilder'
import { buildSystemPrompt } from '@/services/ai/promptBuilder'
import { sendChatMessage, generateSessionPlan } from './geminiClient'

// =============================================================================
// MODULE MOCKS
// =============================================================================

// Mock 1 — Google Generative AI
// The factory must be self-contained: jest.mock() is hoisted above all variable
// declarations, so it cannot close over module-level const/let variables.
// Mock instances are accessed through (GoogleGenerativeAI as jest.Mock).mock.results
// in tests that need them. Implementations are reinstated in beforeEach after
// clearAllMocks() wipes them.
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue('This is the mock coach response.'),
          },
        }),
      }),
    }),
  })),
}))

// Mock 2 — Context builder
jest.mock('@/services/ai/contextBuilder', () => ({
  buildAthleteContext: jest.fn(),
  formatContextForPrompt: jest.fn().mockReturnValue('=== MOCK CONTEXT ==='),
}))

// Mock 3 — Prompt builder
jest.mock('@/services/ai/promptBuilder', () => ({
  buildSystemPrompt: jest.fn().mockReturnValue('Mock system prompt'),
}))

// Mock 4 — Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}))

// Typed references to the mocked functions we assert against
const mockBuildAthleteContext = buildAthleteContext as jest.Mock
const mockBuildSystemPrompt = buildSystemPrompt as jest.Mock

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Navigates the GoogleGenerativeAI mock call tree to retrieve the sendMessage
 * mock from the most recent call. Call AFTER the function under test has run.
 */
function getMockSendMessage(): jest.Mock {
  const genAIInstance = (GoogleGenerativeAI as jest.Mock).mock.results[0]?.value as {
    getGenerativeModel: jest.Mock
  }
  const model = genAIInstance?.getGenerativeModel.mock.results[0]?.value as {
    startChat: jest.Mock
  }
  const chat = model?.startChat.mock.results[0]?.value as { sendMessage: jest.Mock }
  return chat?.sendMessage
}

// =============================================================================
// ENVIRONMENT SETUP
// =============================================================================

beforeAll(() => {
  process.env.GEMINI_API_KEY = 'test-api-key'
})

afterAll(() => {
  delete process.env.GEMINI_API_KEY
})

// =============================================================================
// FACTORIES
// =============================================================================

/**
 * Returns a complete AthleteContext with neutral healthy defaults.
 * Pass overrides to customise individual fields per test.
 */
function makeAthleteContext(
  overrides?: Partial<AthleteContext>,
): AthleteContext {
  return {
    todaysReadiness: null,
    weeklyReadinessAvg: 3.5,
    recentCheckins: [],
    recentSessions: [],
    sessionCountThisWeek: 3,
    lastSessionDate: '2025-03-22',
    daysSinceLastSession: 2,
    currentFingerHealth: 5,
    illnessFlag: false,
    currentProgramme: null,
    activeMesocycle: null,
    currentWeeklyTemplate: [],
    upcomingPlannedSessions: [],
    injuryAreas: [],
    activeInjuryFlags: [],
    criticalInjuryAreas: [],
    lowInjuryAreas: [],
    warnings: [],
    ...overrides,
  }
}

/**
 * Returns a ChatMessage with sensible defaults.
 * Pass overrides to customise individual fields per test.
 */
function makeChatMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'test-message-uuid',
    role: 'user',
    content: 'How is my training going?',
    context_snapshot: null,
    created_at: '2025-03-24T10:00:00Z',
    ...overrides,
  }
}

// =============================================================================
// DEFAULT MOCK SETUP
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()

  // Reinstate GoogleGenerativeAI mock chain — clearAllMocks() wipes implementations
  ;(GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue('This is the mock coach response.'),
          },
        }),
      }),
    }),
  }))

  mockBuildAthleteContext.mockResolvedValue(makeAthleteContext())
  mockBuildSystemPrompt.mockReturnValue('Mock system prompt')
})

// =============================================================================
// TESTS
// =============================================================================

describe('sendChatMessage', () => {
  it('returns a response string from Gemini', async () => {
    const result = await sendChatMessage('user-1', 'What should I train today?', [])

    expect(result.response).toBe('This is the mock coach response.')
  })

  it('returns warnings from athlete context', async () => {
    mockBuildAthleteContext.mockResolvedValue(
      makeAthleteContext({ warnings: ['🔴 ILLNESS FLAG ACTIVE'] }),
    )

    const result = await sendChatMessage('user-1', 'Hello', [])

    expect(result.warnings).toContain('🔴 ILLNESS FLAG ACTIVE')
  })

  it('returns empty warnings array when no warnings', async () => {
    mockBuildAthleteContext.mockResolvedValue(
      makeAthleteContext({ warnings: [] }),
    )

    const result = await sendChatMessage('user-1', 'Hello', [])

    expect(result.warnings).toHaveLength(0)
  })

  it('calls buildAthleteContext once per request', async () => {
    await sendChatMessage('user-1', 'Hello', [])

    expect(mockBuildAthleteContext).toHaveBeenCalledTimes(1)
  })

  it('calls buildSystemPrompt with the athlete context', async () => {
    const context = makeAthleteContext()
    mockBuildAthleteContext.mockResolvedValue(context)

    await sendChatMessage('user-1', 'Hello', [])

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(context)
  })

  it('passes chat history to Gemini startChat', async () => {
    const history = [
      makeChatMessage({ role: 'user', content: 'Hi' }),
      makeChatMessage({ role: 'assistant', content: 'Hello!' }),
    ]

    await sendChatMessage('user-1', 'New message', history)

    const genAIInstance = (GoogleGenerativeAI as jest.Mock).mock.results[0]?.value as {
      getGenerativeModel: jest.Mock
    }
    const model = genAIInstance?.getGenerativeModel.mock.results[0]?.value as {
      startChat: jest.Mock
    }
    expect(model.startChat).toHaveBeenCalled()
    const [startChatArg] = model.startChat.mock.calls[0] as [{ history: unknown[] }]
    expect(Array.isArray(startChatArg.history)).toBe(true)
  })

  it('maps assistant role to model role for Gemini', async () => {
    const history = [makeChatMessage({ role: 'assistant', content: 'Hello' })]

    await sendChatMessage('user-1', 'Test', history)

    const genAIInstance = (GoogleGenerativeAI as jest.Mock).mock.results[0]?.value as {
      getGenerativeModel: jest.Mock
    }
    const model = genAIInstance?.getGenerativeModel.mock.results[0]?.value as {
      startChat: jest.Mock
    }
    const [startChatArg] = model.startChat.mock.calls[0] as [
      { history: Array<{ role: string }> },
    ]
    expect(startChatArg.history.some((h) => h.role === 'model')).toBe(true)
    expect(startChatArg.history.every((h) => h.role !== 'assistant')).toBe(true)
  })

  it('limits history to MAX_HISTORY_MESSAGES (20)', async () => {
    const twentyFiveMessages = Array.from({ length: 25 }, (_, i) =>
      makeChatMessage({ id: `msg-${i}`, content: `Message ${i}` }),
    )

    await sendChatMessage('user-1', 'Test', twentyFiveMessages)

    const genAIInstance = (GoogleGenerativeAI as jest.Mock).mock.results[0]?.value as {
      getGenerativeModel: jest.Mock
    }
    const model = genAIInstance?.getGenerativeModel.mock.results[0]?.value as {
      startChat: jest.Mock
    }
    const [startChatArg] = model.startChat.mock.calls[0] as [{ history: unknown[] }]
    expect(startChatArg.history.length).toBeLessThanOrEqual(20)
  })

  it('throws a safe error message when Gemini API fails', async () => {
    ;(GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({
          sendMessage: jest.fn().mockRejectedValue(new Error('Gemini API quota exceeded')),
        }),
      }),
    }))

    await expect(sendChatMessage('user-1', 'Hello', [])).rejects.toThrow(
      'coach is temporarily unavailable',
    )
  })

  it('throws when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY
    try {
      await expect(sendChatMessage('user-1', 'Hello', [])).rejects.toThrow(
        'coach is temporarily unavailable',
      )
    } finally {
      // Always restore so subsequent tests are not affected
      process.env.GEMINI_API_KEY = 'test-api-key'
    }
  })
})

describe('generateSessionPlan', () => {
  it('returns a session plan string', async () => {
    const result = await generateSessionPlan('user-1', 'bouldering')

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes session type in the generation instruction', async () => {
    await generateSessionPlan('user-1', 'fingerboard')

    const sentMessage = getMockSendMessage().mock.calls[0]?.[0] as string
    expect(sentMessage).toContain('fingerboard')
  })

  it('includes additional context when provided', async () => {
    await generateSessionPlan('user-1', 'strength', 'Focus on shoulder stability this week')

    const sentMessage = getMockSendMessage().mock.calls[0]?.[0] as string
    expect(sentMessage).toContain('shoulder stability')
  })

  it('throws safe error when generation fails', async () => {
    ;(GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({
          sendMessage: jest.fn().mockRejectedValue(new Error('Network error')),
        }),
      }),
    }))

    await expect(generateSessionPlan('user-1', 'bouldering')).rejects.toThrow(
      'coach is temporarily unavailable',
    )
  })
})