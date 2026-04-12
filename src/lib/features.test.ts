import { isFeatureEnabled } from './features'

// Mock the JSON import so we can control flag values per test
jest.mock('../../features.json', () => ({
  chat: true,
}))

describe('isFeatureEnabled', () => {
  it('returns true when a feature is enabled', () => {
    expect(isFeatureEnabled('chat')).toBe(true)
  })

  it('returns false when a feature is disabled', () => {
    const featureFlags = jest.requireMock('../../features.json') as Record<string, boolean>
    featureFlags.chat = false

    expect(isFeatureEnabled('chat')).toBe(false)

    // Restore
    featureFlags.chat = true
  })
})
