import type { AthleteContext } from '@/types'
import { formatContextForPrompt } from '@/services/ai/contextBuilder'
import { buildSystemPrompt } from './promptBuilder'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/services/ai/contextBuilder', () => ({
  formatContextForPrompt: jest.fn().mockReturnValue('=== TEST CONTEXT ==='),
}))

const mockFormatContextForPrompt = formatContextForPrompt as jest.Mock

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Returns an AthleteContext with safe neutral defaults.
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
    sessionCountThisWeek: 2,
    lastSessionDate: '2025-03-22',
    daysSinceLastSession: 2,
    currentFingerHealth: 5,
    currentShoulderHealth: 5,
    illnessFlag: false,
    warnings: [],
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('buildSystemPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFormatContextForPrompt.mockReturnValue('=== TEST CONTEXT ===')
  })

  it('returns a non-empty string', () => {
    const result = buildSystemPrompt(makeAthleteContext())

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes athlete profile information', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('6c/7a')
    expect(prompt).toContain('limestone and granite')
    expect(prompt).toContain('Autumn 2025')
  })

  it('includes shoulder injury warning', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('shoulder')
    expect(prompt).toContain('CRITICAL')
  })

  it('includes return-to-training protocol', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('RETURN-TO-TRAINING')
    expect(prompt).toContain('60%')
  })

  it('includes onsight-specific coaching section', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('onsight')
    expect(prompt).toContain('route reading')
  })

  it('includes the dynamic context section', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('CURRENT ATHLETE CONTEXT')
    expect(prompt).toContain('TEST CONTEXT')
  })

  it('includes all decision rules', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('illness_flag')
    expect(prompt).toContain('finger_health')
    expect(prompt).toContain('SHOULDER HEALTH')
  })

  it('calls formatContextForPrompt with the provided context', () => {
    const context = makeAthleteContext()
    buildSystemPrompt(context)

    expect(mockFormatContextForPrompt).toHaveBeenCalledTimes(1)
    expect(mockFormatContextForPrompt).toHaveBeenCalledWith(context)
  })
})
