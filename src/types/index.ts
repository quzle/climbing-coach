import type { Database } from '@/lib/database.types'

// =============================================================================
// ROW TYPES
// What you get back from SELECT queries. Use these as return types in
// repository functions and as prop types in components.
// =============================================================================

/** A training programme (e.g. "12-week 7a onsight block"). Top-level entity. */
export type Programme = Database['public']['Tables']['programmes']['Row']

/** A training block within a programme (e.g. "Base Endurance Week 1-3"). */
export type Mesocycle = Database['public']['Tables']['mesocycles']['Row']

/** The intended session structure for a given day of the week in a mesocycle. */
export type WeeklyTemplate = Database['public']['Tables']['weekly_templates']['Row']

/** An AI-generated or manually created session plan for a specific date. */
export type PlannedSession = Database['public']['Tables']['planned_sessions']['Row']

/** A tracked injury area in the injury_areas table. */
export type InjuryAreaRow = Database['public']['Tables']['injury_areas']['Row']

/** Payload for adding a new tracked injury area. */
export type InjuryAreaInsert = Database['public']['Tables']['injury_areas']['Insert']

/** Partial update payload for a tracked injury area (e.g. archiving). */
export type InjuryAreaUpdate = Database['public']['Tables']['injury_areas']['Update']

/** A daily subjective readiness check-in (fatigue, sleep, finger health, etc). */
export type ReadinessCheckin = Database['public']['Tables']['readiness_checkins']['Row']

/** A completed training session with structured log data. */
export type SessionLog = Database['public']['Tables']['session_logs']['Row']

/** A single message in the AI coach chat history. */
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

// =============================================================================
// INSERT TYPES
// What you pass to INSERT queries. Optional fields have been made optional
// by Supabase codegen (e.g. id, created_at). Use in repository insert functions.
// =============================================================================

/** Payload for creating a new programme. */
export type ProgrammeInsert = Database['public']['Tables']['programmes']['Insert']

/** Payload for creating a new mesocycle. */
export type MesocycleInsert = Database['public']['Tables']['mesocycles']['Insert']

/** Payload for creating a new weekly template slot. */
export type WeeklyTemplateInsert = Database['public']['Tables']['weekly_templates']['Insert']

/** Payload for creating a new planned session. */
export type PlannedSessionInsert = Database['public']['Tables']['planned_sessions']['Insert']

/** Payload for creating a new readiness check-in. */
export type ReadinessCheckinInsert = Database['public']['Tables']['readiness_checkins']['Insert']

/** Payload for logging a new completed session. */
export type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert']

/** Payload for creating a new chat message. */
export type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert']

// =============================================================================
// UPDATE TYPES
// What you pass to UPDATE queries. All fields are optional. Use in repository
// update functions.
// =============================================================================

/** Partial update payload for a session log (e.g. adding notes after the fact). */
export type SessionLogUpdate = Database['public']['Tables']['session_logs']['Update']

/** Partial update payload for a planned session (e.g. changing status). */
export type PlannedSessionUpdate = Database['public']['Tables']['planned_sessions']['Update']

/** Partial update payload for a readiness check-in. */
export type ReadinessCheckinUpdate = Database['public']['Tables']['readiness_checkins']['Update']

// =============================================================================
// INJURY TRACKING TYPES
// Flexible, body-part-specific injury tracking introduced in ADR 004.
// Replaces the hard-coded shoulder_health / shoulder_flag system from Phase 1.
// =============================================================================

/**
 * All known climbing-relevant injury areas.
 * The trailing `string` allows custom areas not yet in the enum.
 */
export type InjuryArea =
  | 'shoulder_left'
  | 'shoulder_right'
  | 'finger_a2_left'
  | 'finger_a2_right'
  | 'finger_a4_left'
  | 'finger_a4_right'
  | 'finger_pip_left'
  | 'finger_pip_right'
  | 'elbow_medial_left'
  | 'elbow_medial_right'
  | 'elbow_lateral_left'
  | 'elbow_lateral_right'
  | 'wrist_left'
  | 'wrist_right'
  | 'knee_left'
  | 'knee_right'
  | 'ankle_left'
  | 'ankle_right'
  | 'lower_back'
  | 'neck'
  | 'hip_flexor_left'
  | 'hip_flexor_right'
  | (string & Record<never, never>)

/**
 * A single injury area health rating, as stored in
 * readiness_checkins.injury_area_health jsonb.
 */
export type InjuryAreaHealth = {
  area: InjuryArea
  /** Subjective health score 1–5 (1 = cannot train, 5 = pain-free). */
  health: number
  notes: string | null
}

// =============================================================================
// DOMAIN-SPECIFIC TYPES
// String unions representing all valid values for categorical fields.
// Use these instead of raw strings to get compile-time safety.
// =============================================================================

/**
 * All valid training session types across the application.
 * Used in session_logs.session_type, planned_sessions.session_type,
 * weekly_templates.session_type, and the SessionLogData discriminated union.
 */
export type SessionType =
  | 'bouldering'
  | 'kilterboard'
  | 'lead'
  | 'fingerboard'
  | 'strength'
  | 'aerobic'
  | 'rest'
  | 'mobility'

/**
 * Training phase types used in mesocycle planning.
 * Determines the training emphasis and load profile for a block.
 */
export type PhaseType =
  | 'base'
  | 'power'
  | 'power_endurance'
  | 'climbing_specific'
  | 'performance'
  | 'deload'

/**
 * Lifecycle status of a planned session.
 * Tracks whether it was completed as planned, skipped, or deviated from.
 */
export type SessionStatus = 'planned' | 'completed' | 'skipped' | 'modified'

/**
 * Lifecycle status of a mesocycle.
 * 'interrupted' indicates illness, injury, or life circumstances cut the block short.
 */
export type MesocycleStatus = 'completed' | 'active' | 'interrupted' | 'planned'

/**
 * Role of a message in the AI coach chat.
 * Maps directly to chat_messages.role in the database.
 */
export type ChatRole = 'user' | 'assistant'

/**
 * Relative training intensity for a session or weekly template slot.
 * Used as a guide when generating or reviewing sessions.
 */
export type Intensity = 'high' | 'medium' | 'low'

/**
 * Outcome of a single climbing attempt.
 * 'flash' = sent first try, 'send' = sent after prior attempts this session,
 * 'multiple_attempts' = tried but did not send, 'project' = ongoing project.
 */
export type GradeResult = 'flash' | 'send' | 'multiple_attempts' | 'project'

/**
 * Finger grip position used in fingerboard training.
 * 'full_crimp' should be used sparingly — highest injury risk.
 */
export type GripType = 'half_crimp' | 'open_hand' | 'full_crimp' | 'pinch'

/**
 * Rock type for outdoor climbing sessions.
 * Relevant for onsight coaching context (limestone vs granite technique differs).
 */
export type RockType = 'limestone' | 'granite' | 'sandstone' | 'other'

/**
 * Broad location category for a climbing session.
 * Used to distinguish gym training from outdoor performance climbing.
 */
export type LocationType = 'gym' | 'outdoor_single' | 'outdoor_multipitch'

// =============================================================================
// LOG DATA SHAPES
// Typed structures for the session_logs.log_data jsonb field.
// Each session_type has a different data shape — use the SessionLogData
// discriminated union to get the correct shape for a given session type.
// =============================================================================

/**
 * A single climbing attempt on a problem or route.
 * Used within BoulderingLogData and LeadLogData.
 */
export type ClimbingAttempt = {
  grade: string
  style: 'vertical' | 'slab' | 'overhang' | 'roof'
  hold_type: 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'jug'
  result: GradeResult
  attempt_number?: number
  notes?: string
}

/**
 * Structured log data for bouldering and kilterboard sessions.
 * The board and angle fields are relevant for kilterboard sessions.
 */
export type BoulderingLogData = {
  attempts: ClimbingAttempt[]
  location_type: LocationType
  /** e.g. "kilterboard", "moonboard" */
  board?: string
  /** Board angle in degrees — kilterboard sessions only */
  angle?: number
}

/**
 * Structured log data for lead climbing sessions (indoor or outdoor).
 * pitch_count is relevant for outdoor multipitch days.
 */
export type LeadLogData = {
  attempts: ClimbingAttempt[]
  location: string
  rock_type: RockType
  location_type: LocationType
  pitch_count?: number
}

/**
 * A single set within a fingerboard session.
 * added_weight_kg is negative for assisted hangs (e.g. -10 = 10kg assistance).
 */
export type FingerboardSet = {
  edge_mm: number
  grip: GripType
  hang_duration_s: number
  rest_s: number
  reps: number
  /** Positive = added weight, negative = assisted */
  added_weight_kg: number
}

/**
 * Structured log data for fingerboard sessions.
 * Protocol determines how to interpret and compare sessions over time.
 */
export type FingerboardLogData = {
  protocol: 'max_hangs' | 'repeaters' | 'density' | 'other'
  sets: FingerboardSet[]
}

/**
 * A single exercise within a strength session.
 */
export type StrengthExercise = {
  name: string
  sets: number
  reps: number
  /** Total weight including bodyweight additions; 0 = bodyweight only */
  weight_kg: number
  notes?: string
}

/**
 * Structured log data for strength and conditioning sessions.
 * focus_area helps the AI coach understand the session's intent when reviewing load.
 */
export type StrengthLogData = {
  focus_area:
    | 'shoulder_stability'
    | 'pushing'
    | 'pulling'
    | 'core'
    | 'full_body'
    | 'legs'
  exercises: StrengthExercise[]
}

/**
 * Structured log data for aerobic / cross-training sessions.
 * elevation_gain_m is relevant for hiking and ski touring sessions.
 */
export type AerobicLogData = {
  activity: 'hiking' | 'ski_touring' | 'running' | 'cycling' | 'other'
  elevation_gain_m?: number
}

/**
 * Discriminated union mapping each session_type to its typed log data shape.
 * Use this when reading or writing session_logs.log_data to ensure the
 * correct structure is used for each session type.
 *
 * @example
 * function processLog(log: SessionLogData) {
 *   if (log.session_type === 'fingerboard') {
 *     log.data.sets // FingerboardSet[] — fully typed
 *   }
 * }
 */
export type SessionLogData =
  | { session_type: 'bouldering'; data: BoulderingLogData }
  | { session_type: 'kilterboard'; data: BoulderingLogData }
  | { session_type: 'lead'; data: LeadLogData }
  | { session_type: 'fingerboard'; data: FingerboardLogData }
  | { session_type: 'strength'; data: StrengthLogData }
  | { session_type: 'aerobic'; data: AerobicLogData }

// =============================================================================
// ATHLETE CONTEXT TYPE
// Assembled by contextBuilder.ts before every Gemini API call.
// Contains everything the AI coach needs to understand the athlete's
// current state without querying the database itself.
// =============================================================================

/**
 * The full athlete context injected into the AI coaching prompt on every request.
 * Built fresh from Supabase on each serverless function invocation — there is
 * no cached state between requests.
 *
 * @see src/services/ai/contextBuilder.ts
 */

export type AthleteContext = {
  /** Today's readiness check-in, or null if not yet submitted */
  todaysReadiness: ReadinessCheckin | null
  /** Mean readiness score across the last 7 days (0–10 scale) */
  weeklyReadinessAvg: number
  /** Readiness check-ins from the last 7 days, ordered newest first */
  recentCheckins: ReadinessCheckin[]
  /** Session logs from the last 30 days, ordered newest first */
  recentSessions: SessionLog[]
  /** Number of sessions completed in the current calendar week */
  sessionCountThisWeek: number
  /** ISO date string of the most recent session, or null if no sessions exist */
  lastSessionDate: string | null
  /** Number of full days since the last session (0 = trained today) */
  daysSinceLastSession: number
  /** Latest finger_health score from readiness check-ins, or null if no data */
  currentFingerHealth: number | null
  /** True if today's or any recent checkin has illness_flag set */
  illnessFlag: boolean
  /**
   * All tracked injury areas with their current health scores from today's check-in.
   * Populated from readiness_checkins.injury_area_health (jsonb).
   */
  injuryAreas: InjuryAreaHealth[]
  /** Injury area names that were flagged during any recent session (injury_flags jsonb). */
  activeInjuryFlags: string[]
  /** Areas from injuryAreas where health <= 2 — critical, training must be restricted. */
  criticalInjuryAreas: string[]
  /** Areas from injuryAreas where health === 3 — low, training should be reduced. */
  lowInjuryAreas: string[]
  /**
   * Human-readable warning strings surfaced to the AI coach.
   * Examples: "Finger health below threshold — avoid crimping",
   *           "4 consecutive training days — consider rest"
   */
  warnings: string[]
}

// =============================================================================
// API RESPONSE TYPE
// Standard wrapper for all API route responses.
// API routes must always return this shape — never return raw data or errors.
// =============================================================================

/**
 * Standard response envelope for all API routes in this application.
 * Exactly one of data or error will be non-null on any given response.
 *
 * @example
 * // In an API route:
 * return NextResponse.json<ApiResponse<ReadinessCheckin>>({
 *   data: checkin,
 *   error: null,
 * })
 *
 * // In a component:
 * const { data, error } = await res.json<ApiResponse<ReadinessCheckin>>()
 */
export type ApiResponse<T> = {
  data: T | null
  error: string | null
}
