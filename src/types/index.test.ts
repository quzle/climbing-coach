import type {
  ApiResponse,
  AthleteContext,
  GradeResult,
  SessionLog,
  SessionLogData,
  SessionType,
} from '@/types'

// -----------------------------------------------------------------------------
// TYPE TESTING PATTERN
//
// TypeScript types are erased at runtime — they cannot be tested with
// assertions against values. Instead, these tests work by passing
// compile-time typed values to typed functions or typed variables.
//
// If any value in this file is the wrong type, TypeScript will report a
// compile error (red underline) and the test suite will refuse to compile.
// The runtime assertions (expect(true).toBe(true)) confirm the test ran
// rather than testing the value itself — the real gate is the compiler.
// -----------------------------------------------------------------------------

describe('SessionType', () => {
  // Compile-time check: every string below must be assignable to SessionType.
  // If we add or rename a union member in index.ts without updating this test,
  // TypeScript will surface the mismatch immediately.
  function acceptSessionType(_type: SessionType): void {
    // intentionally empty — call site is the test
  }

  it('accepts all valid SessionType values', () => {
    acceptSessionType('bouldering')
    acceptSessionType('kilterboard')
    acceptSessionType('lead')
    acceptSessionType('fingerboard')
    acceptSessionType('strength')
    acceptSessionType('aerobic')
    acceptSessionType('rest')
    acceptSessionType('mobility')
    // If this compiles, all values are valid members of the union.
    expect(true).toBe(true)
  })
})

describe('GradeResult', () => {
  function acceptGradeResult(_result: GradeResult): void {
    // intentionally empty
  }

  it('accepts all valid GradeResult values', () => {
    acceptGradeResult('flash')
    acceptGradeResult('send')
    acceptGradeResult('multiple_attempts')
    acceptGradeResult('project')
    expect(true).toBe(true)
  })
})

describe('AthleteContext', () => {
  it('accepts a fully populated AthleteContext object', () => {
    // Constructing a complete AthleteContext literal verifies that every
    // required field exists with the declared type. A missing or mistyped
    // field will cause a compile error here.
    const mockLog: SessionLog = {
      id: 'log-1',
      date: '2026-03-24',
      session_type: 'bouldering',
      created_at: '2026-03-24T10:00:00Z',
      deviation_from_plan: null,
      duration_mins: 90,
      location: 'The Arch',
      log_data: null,
      notes: null,
      planned_session_id: null,
      quality_rating: 8,
      rpe: 7,
      injury_flags: null,
    }

    const context: AthleteContext = {
      todaysReadiness: null,
      weeklyReadinessAvg: 3.75,
      recentCheckins: [],
      recentSessions: [mockLog],
      sessionCountThisWeek: 2,
      lastSessionDate: '2026-03-24',
      daysSinceLastSession: 0,
      currentFingerHealth: 4,
      illnessFlag: false,
      injuryAreas: [],
      activeInjuryFlags: [],
      criticalInjuryAreas: [],
      lowInjuryAreas: [],
      warnings: ['Consecutive training days — consider rest'],
    }

    expect(context.daysSinceLastSession).toBe(0)
    expect(context.recentSessions).toHaveLength(1)
  })
})

describe('ApiResponse', () => {
  it('accepts ApiResponse<string> with data', () => {
    const response: ApiResponse<string> = { data: 'hello', error: null }
    // Compile-time: data must be string | null, error must be string | null.
    expect(response.data).toBe('hello')
    expect(response.error).toBeNull()
  })

  it('accepts ApiResponse<string> with error', () => {
    const response: ApiResponse<string> = { data: null, error: 'Something went wrong' }
    expect(response.data).toBeNull()
    expect(response.error).toBe('Something went wrong')
  })

  it('accepts ApiResponse<SessionLog> with a full SessionLog', () => {
    const log: SessionLog = {
      id: 'log-2',
      date: '2026-03-20',
      session_type: 'fingerboard',
      created_at: '2026-03-20T08:00:00Z',
      deviation_from_plan: null,
      duration_mins: 45,
      location: null,
      log_data: null,
      notes: 'Max hangs felt strong',
      planned_session_id: null,
      quality_rating: 9,
      rpe: 6,
      injury_flags: null,
    }

    const response: ApiResponse<SessionLog> = { data: log, error: null }
    expect(response.data?.session_type).toBe('fingerboard')
  })
})

describe('SessionLogData discriminated union', () => {
  it('narrows data shape correctly after discriminating on session_type', () => {
    // The discriminated union means TypeScript knows the shape of `entry.data`
    // after checking `entry.session_type`. No type assertions needed.
    const entry: SessionLogData = {
      session_type: 'bouldering',
      data: {
        attempts: [
          {
            grade: '6c',
            style: 'overhang',
            hold_type: 'crimp',
            result: 'send',
            notes: 'crux at the top',
          },
        ],
        location_type: 'gym',
      },
    }

    if (entry.session_type === 'bouldering') {
      // After narrowing, TypeScript knows entry.data is BoulderingLogData.
      // Accessing entry.data.attempts here would error if the type were wrong.
      expect(entry.data.attempts).toHaveLength(1)
      expect(entry.data.attempts[0]?.grade).toBe('6c')
    }

    expect(true).toBe(true)
  })

  it('narrows fingerboard data shape correctly', () => {
    const entry: SessionLogData = {
      session_type: 'fingerboard',
      data: {
        protocol: 'max_hangs',
        sets: [
          {
            edge_mm: 20,
            grip: 'half_crimp',
            hang_duration_s: 10,
            rest_s: 180,
            reps: 6,
            added_weight_kg: 5,
          },
        ],
      },
    }

    if (entry.session_type === 'fingerboard') {
      // TypeScript narrows entry.data to FingerboardLogData here.
      expect(entry.data.protocol).toBe('max_hangs')
      expect(entry.data.sets).toHaveLength(1)
    }

    expect(true).toBe(true)
  })
})
