import { z } from 'zod'

// =============================================================================
// CONSTANTS
// =============================================================================

export const PHASE_TYPES = [
  'base',
  'power',
  'power_endurance',
  'climbing_specific',
  'performance',
  'deload',
] as const

export const SESSION_TYPES = [
  'bouldering',
  'kilterboard',
  'lead',
  'fingerboard',
  'strength',
  'aerobic',
  'rest',
  'mobility',
] as const

export const INTENSITY_LEVELS = ['high', 'medium', 'low'] as const

export const PREFERRED_STYLES = [
  'bouldering',
  'kilterboard',
  'lead',
  'fingerboard',
  'strength',
  'aerobic',
  'mobility',
] as const

export const FOCUS_OPTIONS = ['power', 'endurance', 'technique', 'general'] as const

export const DURATION_WEEK_OPTIONS = [8, 12, 16, 20] as const
export const SESSION_DURATION_OPTIONS = [60, 90, 120] as const

export const DAY_LABELS: Record<number, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
}

export const PHASE_TYPE_LABELS: Record<string, string> = {
  base: 'Base',
  power: 'Power',
  power_endurance: 'Power Endurance',
  climbing_specific: 'Climbing Specific',
  performance: 'Performance',
  deload: 'Deload',
}

export const PREFERRED_STYLE_LABELS: Record<string, string> = {
  bouldering: 'Bouldering',
  kilterboard: 'Kilterboard',
  lead: 'Lead',
  fingerboard: 'Fingerboard',
  strength: 'Strength',
  aerobic: 'Aerobic',
  mobility: 'Mobility',
}

export const FOCUS_LABELS: Record<string, string> = {
  power: 'Power',
  endurance: 'Endurance',
  technique: 'Technique',
  general: 'General / Balanced',
}

// =============================================================================
// WIZARD INPUT SCHEMA
// =============================================================================

export const wizardInputSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(300),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  duration_weeks: z.number().int().min(4).max(52),
  peak_event_label: z.string().max(100).optional(),
  peak_event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  focus: z.enum(FOCUS_OPTIONS),
  injuries: z.string().max(500).optional(),
})

export type WizardInput = z.infer<typeof wizardInputSchema>

// =============================================================================
// GENERATED PLAN SCHEMA  (validates AI JSON output)
// =============================================================================

export const generatedWeeklyTemplateSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  session_label: z.string().max(120),
  session_type: z.enum(SESSION_TYPES),
  intensity: z.enum(INTENSITY_LEVELS),
  duration_mins: z.number().int().min(1).max(480),
  primary_focus: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  notes: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
})

export const generatedMesocycleSchema = z.object({
  name: z.string().max(120),
  focus: z.string().max(500),
  phase_type: z.enum(PHASE_TYPES),
  duration_weeks: z.number().int().min(1).max(20),
  objectives: z.string().max(300),
})

export const generatedPlanSchema = z.object({
  programme: z.object({
    name: z.string().max(120),
    goal: z.string().max(300),
    notes: z
      .string()
      .max(1000)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  }),
  mesocycles: z.array(generatedMesocycleSchema).min(1).max(8),
})

export type GeneratedWeeklyTemplate = z.infer<typeof generatedWeeklyTemplateSchema>
export type GeneratedMesocycle = z.infer<typeof generatedMesocycleSchema>
export type GeneratedPlan = z.infer<typeof generatedPlanSchema>

// =============================================================================
// WEEKLY PLAN INPUT SCHEMA  (Phase 2 — schedule planning)
// =============================================================================

export const dayPinSchema = z.object({
  style: z.enum(PREFERRED_STYLES),
  day_of_week: z.number().int().min(0).max(6),
  locked: z.boolean(),
})

export const weeklyPlanInputSchema = z.object({
  available_days: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one training day'),
  preferred_duration_mins: z.number().int(),
  preferred_styles: z.array(z.enum(PREFERRED_STYLES)).min(1, 'Select at least one style'),
  day_pins: z.array(dayPinSchema).default([]),
})

export type DayPin = z.infer<typeof dayPinSchema>
export type WeeklyPlanInput = z.infer<typeof weeklyPlanInputSchema>

// =============================================================================
// DATE HELPERS  (shared between server routes and client UI)
// =============================================================================

/** Returns a new ISO date string offset by the given number of days. */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]!
}

/**
 * Computes {start, end} date pairs for each mesocycle in a generated plan,
 * given the programme start date.
 */
export function computeMesocycleDates(
  mesocycles: GeneratedMesocycle[],
  startDate: string,
): Array<{ start: string; end: string }> {
  const result: Array<{ start: string; end: string }> = []
  let cursor = startDate
  for (const meso of mesocycles) {
    const end = addDaysToDate(cursor, meso.duration_weeks * 7 - 1)
    result.push({ start: cursor, end })
    cursor = addDaysToDate(end, 1)
  }
  return result
}
