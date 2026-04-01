import { renderHook, act } from '@testing-library/react'
import { useChatHistory, type StoredChatMessage } from './useChatHistory'

// =============================================================================
// localStorage MOCK
// =============================================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
})

const TEST_USER_ID = 'user-test-456'
const TEST_THREAD_ID = 'thread-test-789'
const EXPECTED_KEY = `climbing-coach:chat-history:${TEST_USER_ID}`
const EXPECTED_THREAD_KEY = `climbing-coach:chat-history:${TEST_USER_ID}:${TEST_THREAD_ID}`

// =============================================================================
// HELPERS
// =============================================================================

function makeMessage(overrides: Partial<StoredChatMessage> = {}): StoredChatMessage {
  return {
    id: 'test-id',
    role: 'user',
    content: 'Hello',
    context_snapshot: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('useChatHistory — initial state', () => {
  it('returns empty messages array when localStorage is empty', () => {
    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))
    expect(result.current.messages).toEqual([])
  })

  it('loads existing history from localStorage on mount', () => {
    const stored = [makeMessage({ id: 'msg-1', content: 'Loaded message' })]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(stored))

    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Loaded message')
  })

  it('handles corrupted localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValueOnce('not valid json {{{')

    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    expect(result.current.messages).toEqual([])
    // No error thrown — hook renders successfully
  })

  it('uses a per-thread key when threadId is provided', () => {
    const stored = [makeMessage({ id: 'thread-msg', content: 'Thread message' })]
    localStorageMock.getItem.mockImplementation((key: string) =>
      key === EXPECTED_THREAD_KEY ? JSON.stringify(stored) : null,
    )

    const { result } = renderHook(() => useChatHistory(TEST_USER_ID, TEST_THREAD_ID))

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Thread message')
  })
})

describe('useChatHistory — addMessage', () => {
  it('appends a message to the messages array', () => {
    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-1', content: 'Hello coach' }))
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Hello coach')
  })

  it('persists messages to localStorage using the user-scoped key', () => {
    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-1' }))
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      EXPECTED_KEY,
      expect.stringContaining('msg-1'),
    )
  })

  it('persists messages using the thread-scoped key when threadId is provided', () => {
    const { result } = renderHook(() => useChatHistory(TEST_USER_ID, TEST_THREAD_ID))

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-thread' }))
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      EXPECTED_THREAD_KEY,
      expect.stringContaining('msg-thread'),
    )
  })

  it('preserves message order with oldest first', () => {
    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    act(() => {
      result.current.addMessage(makeMessage({ id: 'first', content: 'First' }))
    })
    act(() => {
      result.current.addMessage(makeMessage({ id: 'second', content: 'Second' }))
    })

    expect(result.current.messages[0]!.id).toBe('first')
    expect(result.current.messages[1]!.id).toBe('second')
  })

  it('caps messages at 50 and drops the oldest when limit is exceeded', () => {
    // Pre-fill localStorage with exactly 50 messages
    const initial = Array.from({ length: 50 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, content: `Message ${i}` }),
    )
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(initial))

    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-new', content: 'New' }))
    })

    expect(result.current.messages).toHaveLength(50)
    expect(result.current.messages[49]!.id).toBe('msg-new')
    // msg-0 was the oldest and should have been dropped
    expect(result.current.messages[0]!.id).toBe('msg-1')
  })

  it('stores assistant warnings on the message', () => {
    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    act(() => {
      result.current.addMessage(
        makeMessage({
          id: 'msg-1',
          role: 'assistant',
          warnings: ['🔴 Finger load warning'],
        }),
      )
    })

    expect(result.current.messages[0]!.warnings).toEqual(['🔴 Finger load warning'])
  })
})

describe('useChatHistory — clearHistory', () => {
  it('removes all messages from state and localStorage using the user-scoped key', () => {
    const { result } = renderHook(() => useChatHistory(TEST_USER_ID))

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-1' }))
    })
    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.messages).toEqual([])
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(EXPECTED_KEY)
  })
})
