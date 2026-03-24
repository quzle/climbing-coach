import { z } from 'zod'

/**
 * Flat Zod schema covering all RHF-managed fields across the session log form.
 * Fields are optional where not universally required — the parent form applies
 * session-type-specific superRefine rules before submission.
 *
 * Attempts, sets, and exercises are managed outside RHF (arrays in parent state)
 * and are NOT included here.
 */
export const sessionLogFormSchema = z.object({
  // ── Core ──────────────────────────────────────────────────────────────────
  session_type: z.enum([
    'bouldering',
    'kilterboard',
    'lead',
    'fingerboard',
    'strength',
    'aerobic',
    'rest',
    'mobility',
  ]),
  planned_session_id: z.string().uuid().optional(),

  // ── Common ────────────────────────────────────────────────────────────────
  date: z.string().min(1, 'Date is required'),
  duration_mins: z.number().int().positive().max(480).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  quality_rating: z.number().int().min(1).max(5).optional(),
  shoulder_flag: z.boolean(),
  notes: z.string().max(1000).optional(),

  // ── Climbing (bouldering / kilterboard / lead) ────────────────────────────
  location: z.string().max(100).optional(),
  location_type: z.enum(['gym', 'outdoor_single', 'outdoor_multipitch']).optional(),
  rock_type: z.enum(['limestone', 'granite', 'sandstone', 'other']).optional(),
  /** Kilterboard angle in degrees */
  angle: z.number().int().min(0).max(70).optional(),
  /** Lead: number of pitches */
  pitch_count: z.number().int().min(1).max(20).optional(),

  // ── Strength ──────────────────────────────────────────────────────────────
  focus_area: z
    .enum(['shoulder_stability', 'pushing', 'pulling', 'core', 'full_body', 'legs'])
    .optional(),

  // ── Aerobic ───────────────────────────────────────────────────────────────
  activity: z.enum(['hiking', 'ski_touring', 'running', 'cycling', 'other']).optional(),
  elevation_gain_m: z.number().int().min(0).optional(),
})

export type SessionLogFormData = z.infer<typeof sessionLogFormSchema>
