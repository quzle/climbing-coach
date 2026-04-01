import { getUserStorageKeys, clearUserStorage } from './user-storage'

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
    get length() {
      return Object.keys(store).length
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

function seed(entries: Record<string, string>): void {
  Object.entries(entries).forEach(([k, v]) => {
    localStorageMock.setItem(k, v)
  })
}

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
})

// =============================================================================
// getUserStorageKeys
// =============================================================================

describe('getUserStorageKeys', () => {
  it('returns draft and chat-history keys for the given user', () => {
    seed({
      'climbing-coach:session-draft:user-a': '{}',
      'climbing-coach:chat-history:user-a': '[]',
      'climbing-coach:chat-history:user-a:thread-1': '[]',
    })

    const keys = getUserStorageKeys('user-a')

    expect(keys).toHaveLength(3)
    expect(keys).toContain('climbing-coach:session-draft:user-a')
    expect(keys).toContain('climbing-coach:chat-history:user-a')
    expect(keys).toContain('climbing-coach:chat-history:user-a:thread-1')
  })

  it('does not return keys belonging to a different user', () => {
    seed({
      'climbing-coach:session-draft:user-a': '{}',
      'climbing-coach:session-draft:user-b': '{}',
    })

    const keys = getUserStorageKeys('user-a')

    expect(keys).toHaveLength(1)
    expect(keys).not.toContain('climbing-coach:session-draft:user-b')
  })

  it('returns an empty array when no keys match', () => {
    seed({ 'some-other-key': 'value' })

    expect(getUserStorageKeys('user-a')).toEqual([])
  })
})

// =============================================================================
// clearUserStorage
// =============================================================================

describe('clearUserStorage', () => {
  it('removes all user-scoped keys for the given user', () => {
    seed({
      'climbing-coach:session-draft:user-a': '{}',
      'climbing-coach:chat-history:user-a': '[]',
    })

    clearUserStorage('user-a')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'climbing-coach:session-draft:user-a',
    )
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'climbing-coach:chat-history:user-a',
    )
  })

  it('does not touch keys belonging to a different user', () => {
    seed({
      'climbing-coach:session-draft:user-a': '{}',
      'climbing-coach:session-draft:user-b': '{}',
    })

    clearUserStorage('user-a')

    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(
      'climbing-coach:session-draft:user-b',
    )
  })
})

// =============================================================================
// CLIENT-8 — Same-browser account switching isolation
// =============================================================================

describe('account switching isolation', () => {
  it('user B has no access to user A draft after logout', () => {
    // User A logs in and saves a draft
    seed({
      'climbing-coach:session-draft:user-a': JSON.stringify({ sessionType: 'bouldering' }),
    })

    // User A logs out — their storage is cleared
    clearUserStorage('user-a')

    // User B logs in — their storage should be empty
    const userBKeys = getUserStorageKeys('user-b')
    expect(userBKeys).toHaveLength(0)
  })

  it('user B has no access to user A chat history after logout', () => {
    seed({
      'climbing-coach:chat-history:user-a': JSON.stringify([{ id: 'msg-1', content: 'secret' }]),
    })

    clearUserStorage('user-a')

    const userBKeys = getUserStorageKeys('user-b')
    expect(userBKeys).toHaveLength(0)
  })

  it('clearing user A storage does not affect user B existing data', () => {
    // Both users have data in storage simultaneously
    seed({
      'climbing-coach:session-draft:user-a': JSON.stringify({ sessionType: 'lead' }),
      'climbing-coach:chat-history:user-a': '[]',
      'climbing-coach:session-draft:user-b': JSON.stringify({ sessionType: 'strength' }),
      'climbing-coach:chat-history:user-b': JSON.stringify([{ id: 'b-msg' }]),
    })

    // User A logs out
    clearUserStorage('user-a')

    // User B's data remains intact
    const userBKeys = getUserStorageKeys('user-b')
    expect(userBKeys).toHaveLength(2)
    expect(userBKeys).toContain('climbing-coach:session-draft:user-b')
    expect(userBKeys).toContain('climbing-coach:chat-history:user-b')
  })

  it('clearing user A removes all thread-scoped chat keys for user A', () => {
    seed({
      'climbing-coach:chat-history:user-a': '[]',
      'climbing-coach:chat-history:user-a:thread-1': '[]',
      'climbing-coach:chat-history:user-a:thread-2': '[]',
      'climbing-coach:chat-history:user-b': '[]',
    })

    clearUserStorage('user-a')

    const userAKeys = getUserStorageKeys('user-a')
    expect(userAKeys).toHaveLength(0)

    const userBKeys = getUserStorageKeys('user-b')
    expect(userBKeys).toHaveLength(1)
  })
})
