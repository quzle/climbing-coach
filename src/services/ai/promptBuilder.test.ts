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
    injuryAreas: [],
    criticalInjuryAreas: [],
    lowInjuryAreas: [],
    activeInjuryFlags: [],
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

  it('includes injury area reference in athlete profile', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('injury area')
    expect(prompt).toContain('CURRENT ATHLETE CONTEXT')
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
    expect(prompt).toContain('TRACKED INJURY AREAS')
  })

  it('shows no tracked areas when injuryAreas is empty', () => {
    const prompt = buildSystemPrompt(makeAthleteContext({ injuryAreas: [] }))

    expect(prompt).toContain('None currently tracked')
  })

  it('includes tracked area name and health when injuryAreas is populated', () => {
    const prompt = buildSystemPrompt(
      makeAthleteContext({
        injuryAreas: [{ area: 'shoulder_left', health: 3, notes: null }],
        criticalInjuryAreas: [],
        lowInjuryAreas: ['shoulder_left'],
      }),
    )

    expect(prompt).toContain('shoulder_left')
    expect(prompt).toContain('3/5')
    expect(prompt).toContain('[LOW]')
  })

  it('includes CRITICAL label and critical area guidance when area health <= 2', () => {
    const prompt = buildSystemPrompt(
      makeAthleteContext({
        injuryAreas: [{ area: 'wrist_left', health: 2, notes: null }],
        criticalInjuryAreas: ['wrist_left'],
        lowInjuryAreas: [],
      }),
    )

    expect(prompt).toContain('[CRITICAL]')
    expect(prompt).toContain('wrist_left')
    expect(prompt).toContain('Flag immediately')
  })

  it('calls formatContextForPrompt with the provided context', () => {
    const context = makeAthleteContext()
    buildSystemPrompt(context)

    expect(mockFormatContextForPrompt).toHaveBeenCalledTimes(1)
    expect(mockFormatContextForPrompt).toHaveBeenCalledWith(context)
  })
})
