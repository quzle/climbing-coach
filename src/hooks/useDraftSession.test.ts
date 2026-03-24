import { renderHook, act } from '@testing-library/react'
import { useDraftSession } from './useDraftSession'

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
// TESTS
// =============================================================================

describe('useDraftSession — initial state', () => {
  it('returns null draft when localStorage is empty', () => {
    const { result } = renderHook(() => useDraftSession())
    expect(result.current.draft).toBeNull()
    expect(result.current.hasDraft).toBe(false)
  })

  it('loads existing draft from localStorage on mount', () => {
    const mockDraft = {
      sessionType: 'bouldering',
      date: '2025-03-24',
      attempts: [],
      fingerboardSets: [],
      exercises: [],
      shoulder_flag: false,
      stage: 2,
      lastSaved: new Date().toISOString(),
      location: null,
      duration_mins: null,
      quality_rating: null,
      rpe: null,
      notes: null,
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(mockDraft))

    const { result } = renderHook(() => useDraftSession())
    expect(result.current.hasDraft).toBe(true)
    expect(result.current.draft?.sessionType).toBe('bouldering')
  })

  it('ignores expired drafts', () => {
    const expiredDraft = {
      sessionType: 'bouldering',
      lastSaved: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(), // 13 hours ago
      attempts: [],
      fingerboardSets: [],
      exercises: [],
      shoulder_flag: false,
      stage: 1,
      date: '2025-03-23',
      location: null,
      duration_mins: null,
      quality_rating: null,
      rpe: null,
      notes: null,
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(expiredDraft))

    const { result } = renderHook(() => useDraftSession())
    expect(result.current.hasDraft).toBe(false)
    expect(result.current.draft).toBeNull()
  })

  it('handles corrupted localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValueOnce('not valid json {{{')

    const { result } = renderHook(() => useDraftSession())
    expect(result.current.hasDraft).toBe(false)
    // No error thrown — hook renders successfully
  })
})

describe('useDraftSession — saveDraft', () => {
  it('saves draft to localStorage', () => {
    const { result } = renderHook(() => useDraftSession())

    act(() => {
      result.current.saveDraft({ sessionType: 'strength', stage: 2 })
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'climbing-coach:session-draft',
      expect.stringContaining('strength'),
    )
  })

  it('updates hasDraft to true after saving', () => {
    const { result } = renderHook(() => useDraftSession())
    expect(result.current.hasDraft).toBe(false)

    act(() => {
      result.current.saveDraft({ sessionType: 'aerobic' })
    })

    expect(result.current.hasDraft).toBe(true)
  })

  it('merges updates with existing draft', () => {
    const { result } = renderHook(() => useDraftSession())

    act(() => {
      result.current.saveDraft({ sessionType: 'bouldering', stage: 2 })
    })
    act(() => {
      result.current.saveDraft({ notes: 'Felt strong today' })
    })

    expect(result.current.draft?.sessionType).toBe('bouldering')
    expect(result.current.draft?.notes).toBe('Felt strong today')
  })
})

describe('useDraftSession — clearDraft', () => {
  it('removes draft from localStorage', () => {
    const { result } = renderHook(() => useDraftSession())

    act(() => {
      result.current.saveDraft({ sessionType: 'lead' })
    })
    act(() => {
      result.current.clearDraft()
    })

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'climbing-coach:session-draft',
    )
    expect(result.current.hasDraft).toBe(false)
    expect(result.current.draft).toBeNull()
  })
})
