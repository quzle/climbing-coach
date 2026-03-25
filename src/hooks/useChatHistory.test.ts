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
    const { result } = renderHook(() => useChatHistory())
    expect(result.current.messages).toEqual([])
  })

  it('loads existing history from localStorage on mount', () => {
    const stored = [makeMessage({ id: 'msg-1', content: 'Loaded message' })]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(stored))

    const { result } = renderHook(() => useChatHistory())

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Loaded message')
  })

  it('handles corrupted localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValueOnce('not valid json {{{')

    const { result } = renderHook(() => useChatHistory())

    expect(result.current.messages).toEqual([])
    // No error thrown — hook renders successfully
  })
})

describe('useChatHistory — addMessage', () => {
  it('appends a message to the messages array', () => {
    const { result } = renderHook(() => useChatHistory())

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-1', content: 'Hello coach' }))
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]!.content).toBe('Hello coach')
  })

  it('persists messages to localStorage', () => {
    const { result } = renderHook(() => useChatHistory())

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-1' }))
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'climbing-coach:chat-history',
      expect.stringContaining('msg-1'),
    )
  })

  it('preserves message order with oldest first', () => {
    const { result } = renderHook(() => useChatHistory())

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

    const { result } = renderHook(() => useChatHistory())

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-new', content: 'New' }))
    })

    expect(result.current.messages).toHaveLength(50)
    expect(result.current.messages[49]!.id).toBe('msg-new')
    // msg-0 was the oldest and should have been dropped
    expect(result.current.messages[0]!.id).toBe('msg-1')
  })

  it('stores assistant warnings on the message', () => {
    const { result } = renderHook(() => useChatHistory())

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
  it('removes all messages from state and localStorage', () => {
    const { result } = renderHook(() => useChatHistory())

    act(() => {
      result.current.addMessage(makeMessage({ id: 'msg-1' }))
    })
    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.messages).toEqual([])
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('climbing-coach:chat-history')
  })
})
