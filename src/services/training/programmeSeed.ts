import { createMesocycle } from '@/services/data/mesocycleRepository'
import { createPlannedSession } from '@/services/data/plannedSessionRepository'
import {
  createProgramme,
  getProgrammes,
} from '@/services/data/programmeRepository'
import { createWeeklyTemplate } from '@/services/data/weeklyTemplateRepository'
import type {
  ApiResponse,
  Intensity,
  MesocycleInsert,
  PhaseType,
  PlannedSessionInsert,
  ProgrammeInsert,
  SessionType,
  WeeklyTemplateInsert,
} from '@/types'

const PHASE_2F_SEED_MARKER = '[phase2f-seed:v1]'

type TemplateBlueprint = {
  dayOfWeek: number
  sessionLabel: string
  sessionType: SessionType
  intensity: Intensity
  durationMins: number
  primaryFocus: string
  notes: string | null
}

type MesocycleBlueprint = {
  name: string
  focus: string
  phaseType: PhaseType
  plannedStart: string
  plannedEnd: string
  status: 'active' | 'planned'
  templates: TemplateBlueprint[]
}

type ProgrammeBlueprint = {
  programme: ProgrammeInsert
  mesocycles: MesocycleBlueprint[]
}

/**
 * @description Summary returned after attempting to seed the starter programme.
 */
export type SeedProgrammeResult = {
  seeded: boolean
  programmeId: string
  programmeName: string
  createdMesocycleCount: number
  createdWeeklyTemplateCount: number
  createdPlannedSessionCount: number
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

function parseIsoDateUtc(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1))
}

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function getCurrentWeekMonday(): Date {
  const now = new Date()
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const day = date.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addUtcDays(date, mondayOffset)
}

function buildSeedNotes(existingNotes: string | null): string {
  return existingNotes === null || existingNotes.trim() === ''
    ? PHASE_2F_SEED_MARKER
    : `${existingNotes}\n\n${PHASE_2F_SEED_MARKER}`
}

function aiPlanText(
  phaseName: string,
  template: TemplateBlueprint,
  weekNumber: number,
): string {
  return [
    `${phaseName} week ${weekNumber}: ${template.sessionLabel}.`,
    `Primary focus: ${template.primaryFocus}.`,
    `Keep intensity ${template.intensity} and target roughly ${template.durationMins} minutes.`,
    'Log how the session felt so later planned-vs-actual comparison has a clean baseline.',
  ].join(' ')
}

function makeTemplates(definitions: TemplateBlueprint[]): TemplateBlueprint[] {
  return definitions
}

function buildProgrammeBlueprint(): ProgrammeBlueprint {
  const programmeStart = getCurrentWeekMonday()
  const programmeEnd = addUtcDays(programmeStart, 16 * 7 - 1)

  const baseTemplates = makeTemplates([
    {
      dayOfWeek: 1,
      sessionLabel: 'Aerobic Base + Easy Mileage',
      sessionType: 'aerobic',
      intensity: 'low',
      durationMins: 75,
      primaryFocus: 'Low-intensity aerobic support and movement volume',
      notes: 'Easy effort only. Nose-breathing pace if done hiking or easy circuits.',
    },
    {
      dayOfWeek: 2,
      sessionLabel: 'General Strength',
      sessionType: 'strength',
      intensity: 'medium',
      durationMins: 60,
      primaryFocus: 'Shoulder stability and trunk tension',
      notes: 'Keep 2 reps in reserve on loaded movements.',
    },
    {
      dayOfWeek: 3,
      sessionLabel: 'Technique Bouldering',
      sessionType: 'bouldering',
      intensity: 'medium',
      durationMins: 90,
      primaryFocus: 'Precise feet and efficient body positioning',
      notes: 'Submaximal problems with good rests.',
    },
    {
      dayOfWeek: 4,
      sessionLabel: 'Mobility and Tissue Care',
      sessionType: 'mobility',
      intensity: 'low',
      durationMins: 40,
      primaryFocus: 'Thoracic mobility and hip range of motion',
      notes: 'Recovery emphasis.',
    },
    {
      dayOfWeek: 5,
      sessionLabel: 'Intro Fingerboard Density',
      sessionType: 'fingerboard',
      intensity: 'medium',
      durationMins: 55,
      primaryFocus: 'Repeatable half-crimp recruitment without maximal load',
      notes: 'Skip if fingers feel tweaky.',
    },
    {
      dayOfWeek: 6,
      sessionLabel: 'Endurance Lead Volume',
      sessionType: 'lead',
      intensity: 'medium',
      durationMins: 120,
      primaryFocus: 'Route mileage and pacing for long days out',
      notes: 'Aim for relaxed movement between clips.',
    },
    {
      dayOfWeek: 7,
      sessionLabel: 'Rest and Walk',
      sessionType: 'rest',
      intensity: 'low',
      durationMins: 30,
      primaryFocus: 'Recovery, steps, and fueling check-in',
      notes: 'Optional easy walk only.',
    },
  ])

  const powerTemplates = makeTemplates([
    {
      dayOfWeek: 1,
      sessionLabel: 'Max Hang Session',
      sessionType: 'fingerboard',
      intensity: 'high',
      durationMins: 60,
      primaryFocus: 'High-quality finger recruitment',
      notes: 'Long rests, low total volume.',
    },
    {
      dayOfWeek: 2,
      sessionLabel: 'Restorative Mobility',
      sessionType: 'mobility',
      intensity: 'low',
      durationMins: 35,
      primaryFocus: 'Shoulder recovery and forearm tissue care',
      notes: 'No loading beyond bodyweight.',
    },
    {
      dayOfWeek: 3,
      sessionLabel: 'Limit Bouldering',
      sessionType: 'bouldering',
      intensity: 'high',
      durationMins: 95,
      primaryFocus: 'Explosive movement and high-end recruitment',
      notes: 'Keep attempts low and high quality.',
    },
    {
      dayOfWeek: 4,
      sessionLabel: 'Strength Maintenance',
      sessionType: 'strength',
      intensity: 'medium',
      durationMins: 55,
      primaryFocus: 'Weighted pull strength and trunk stiffness',
      notes: 'Keep fatigue low so Saturday stays useful.',
    },
    {
      dayOfWeek: 5,
      sessionLabel: 'Aerobic Flush',
      sessionType: 'aerobic',
      intensity: 'low',
      durationMins: 50,
      primaryFocus: 'Recovery support between power sessions',
      notes: 'Easy spin, hike, or easy circuits.',
    },
    {
      dayOfWeek: 6,
      sessionLabel: 'Steep Lead Power',
      sessionType: 'lead',
      intensity: 'medium',
      durationMins: 110,
      primaryFocus: 'Harder sequences with full rests',
      notes: 'Pick terrain that rewards precision under power.',
    },
    {
      dayOfWeek: 7,
      sessionLabel: 'Full Rest',
      sessionType: 'rest',
      intensity: 'low',
      durationMins: 20,
      primaryFocus: 'Recovery and sleep extension',
      notes: 'No structured training.',
    },
  ])

  const powerEnduranceTemplates = makeTemplates([
    {
      dayOfWeek: 1,
      sessionLabel: 'Aerobic Capacity Intervals',
      sessionType: 'aerobic',
      intensity: 'medium',
      durationMins: 70,
      primaryFocus: 'Sustained work capacity',
      notes: 'Controlled but steady discomfort.',
    },
    {
      dayOfWeek: 2,
      sessionLabel: 'Strength Top-Up',
      sessionType: 'strength',
      intensity: 'medium',
      durationMins: 50,
      primaryFocus: 'Keep force production without adding fatigue',
      notes: 'Low volume.',
    },
    {
      dayOfWeek: 3,
      sessionLabel: 'Route PE Intervals',
      sessionType: 'lead',
      intensity: 'high',
      durationMins: 110,
      primaryFocus: 'Recover while climbing and resist forearm pump',
      notes: 'Link sections with short rests.',
    },
    {
      dayOfWeek: 4,
      sessionLabel: 'Mobility Reset',
      sessionType: 'mobility',
      intensity: 'low',
      durationMins: 35,
      primaryFocus: 'Recovery before weekend specificity',
      notes: 'Easy recovery circuit.',
    },
    {
      dayOfWeek: 5,
      sessionLabel: 'Bouldering Power-Endurance',
      sessionType: 'bouldering',
      intensity: 'medium',
      durationMins: 85,
      primaryFocus: 'Repeat hard moves with incomplete recovery',
      notes: '4x4 or linked blocs style.',
    },
    {
      dayOfWeek: 6,
      sessionLabel: 'Multipitch Simulation Day',
      sessionType: 'lead',
      intensity: 'high',
      durationMins: 150,
      primaryFocus: 'Back-to-back pitches and pacing strategy',
      notes: 'Treat transitions like a real day out.',
    },
    {
      dayOfWeek: 7,
      sessionLabel: 'Rest and Fuel Prep',
      sessionType: 'rest',
      intensity: 'low',
      durationMins: 20,
      primaryFocus: 'Recovery and logistics prep',
      notes: 'Prioritise food, sleep, and planning.',
    },
  ])

  const performanceTemplates = makeTemplates([
    {
      dayOfWeek: 1,
      sessionLabel: 'Mobility Primer',
      sessionType: 'mobility',
      intensity: 'low',
      durationMins: 30,
      primaryFocus: 'Stay fresh and mobile',
      notes: 'Short and easy.',
    },
    {
      dayOfWeek: 2,
      sessionLabel: 'Lead Precision',
      sessionType: 'lead',
      intensity: 'medium',
      durationMins: 90,
      primaryFocus: 'Execution on terrain similar to the target objective',
      notes: 'Plenty of rest between serious burns.',
    },
    {
      dayOfWeek: 3,
      sessionLabel: 'Full Rest',
      sessionType: 'rest',
      intensity: 'low',
      durationMins: 20,
      primaryFocus: 'Freshness ahead of harder efforts',
      notes: 'No structured work.',
    },
    {
      dayOfWeek: 4,
      sessionLabel: 'Sharpness Bouldering',
      sessionType: 'bouldering',
      intensity: 'medium',
      durationMins: 70,
      primaryFocus: 'Movement sharpness without fatigue',
      notes: 'Stop early if power fades.',
    },
    {
      dayOfWeek: 5,
      sessionLabel: 'Travel and Mobility',
      sessionType: 'mobility',
      intensity: 'low',
      durationMins: 25,
      primaryFocus: 'Arrive feeling loose, not worked',
      notes: 'Ideal pre-trip routine.',
    },
    {
      dayOfWeek: 6,
      sessionLabel: 'Big Objective Day',
      sessionType: 'lead',
      intensity: 'high',
      durationMins: 180,
      primaryFocus: 'Execute on long routes with calm pacing',
      notes: 'Treat as the key day of the week.',
    },
    {
      dayOfWeek: 7,
      sessionLabel: 'Rest and Debrief',
      sessionType: 'rest',
      intensity: 'low',
      durationMins: 25,
      primaryFocus: 'Recover and capture learnings',
      notes: 'Note what to adjust before the next objective day.',
    },
  ])

  const mesocycles: MesocycleBlueprint[] = [
    {
      name: 'Base Endurance Foundation',
      focus: 'Build movement volume, aerobic support, and tissue tolerance for a long summer block.',
      phaseType: 'base',
      plannedStart: toIsoDate(programmeStart),
      plannedEnd: toIsoDate(addUtcDays(programmeStart, 27)),
      status: 'active',
      templates: baseTemplates,
    },
    {
      name: 'Power and Finger Strength',
      focus: 'Raise peak force and movement power without losing rope-specific practice.',
      phaseType: 'power',
      plannedStart: toIsoDate(addUtcDays(programmeStart, 28)),
      plannedEnd: toIsoDate(addUtcDays(programmeStart, 55)),
      status: 'planned',
      templates: powerTemplates,
    },
    {
      name: 'Power Endurance Conversion',
      focus: 'Convert new power into sustainable route performance and repeated hard efforts.',
      phaseType: 'power_endurance',
      plannedStart: toIsoDate(addUtcDays(programmeStart, 56)),
      plannedEnd: toIsoDate(addUtcDays(programmeStart, 83)),
      status: 'planned',
      templates: powerEnduranceTemplates,
    },
    {
      name: 'Performance Taper and Execution',
      focus: 'Reduce fatigue, keep sharpness, and bias training toward big route execution.',
      phaseType: 'performance',
      plannedStart: toIsoDate(addUtcDays(programmeStart, 84)),
      plannedEnd: toIsoDate(programmeEnd),
      status: 'planned',
      templates: performanceTemplates,
    },
  ]

  return {
    programme: {
      name: 'Summer Multipitch Season',
      goal: 'Arrive at summer objectives with enough endurance, finger strength, and execution quality for long routes.',
      start_date: toIsoDate(programmeStart),
      target_date: toIsoDate(programmeEnd),
      notes: buildSeedNotes('Phase 2F starter seed for programme-layer development.'),
    },
    mesocycles,
  }
}

function buildPlannedSessionsForMesocycle(
  mesocycleId: string,
  mesocycle: MesocycleBlueprint,
  templateIdsByDay: Map<number, string>,
): PlannedSessionInsert[] {
  const startDate = parseIsoDateUtc(mesocycle.plannedStart)
  const plannedSessions: PlannedSessionInsert[] = []

  for (let weekIndex = 0; weekIndex < 2; weekIndex += 1) {
    for (const template of mesocycle.templates) {
      const plannedDate = toIsoDate(
        addUtcDays(startDate, weekIndex * 7 + template.dayOfWeek - 1),
      )

      plannedSessions.push({
        mesocycle_id: mesocycleId,
        template_id: templateIdsByDay.get(template.dayOfWeek) ?? null,
        planned_date: plannedDate,
        session_type: template.sessionType,
        status: 'planned',
        generation_notes: 'Phase 2F starter seed',
        generated_plan: {
          session_label: template.sessionLabel,
          intensity: template.intensity,
          primary_focus: template.primaryFocus,
          duration_mins: template.durationMins,
          ai_plan_text: aiPlanText(mesocycle.name, template, weekIndex + 1),
        },
      })
    }
  }

  return plannedSessions
}

/**
 * @description Seeds a deterministic 16-week summer multipitch programme in development-oriented environments.
 * It creates one programme, four mesocycles, weekly templates for each mesocycle, and two weeks of planned sessions for the active block.
 * Re-running the seed is idempotent: once the marked programme exists, no duplicate rows are created.
 * @returns Summary of what was created, or a non-error summary when the seed already exists.
 */
export async function seedSummerMultipitchProgramme(): Promise<
  ApiResponse<SeedProgrammeResult>
> {
  try {
    const existingProgrammesResult = await getProgrammes()
    if (existingProgrammesResult.error !== null) {
      console.error(
        '[programmeSeed.seedSummerMultipitchProgramme] getProgrammes:',
        existingProgrammesResult.error,
      )
      return { data: null, error: existingProgrammesResult.error }
    }

    const blueprint = buildProgrammeBlueprint()
    const existingProgramme = (existingProgrammesResult.data ?? []).find(
      (programme) =>
        (programme.notes?.includes(PHASE_2F_SEED_MARKER) ?? false) ||
        programme.name === blueprint.programme.name,
    )

    if (existingProgramme !== undefined) {
      return {
        data: {
          seeded: false,
          programmeId: existingProgramme.id,
          programmeName: existingProgramme.name,
          createdMesocycleCount: 0,
          createdWeeklyTemplateCount: 0,
          createdPlannedSessionCount: 0,
        },
        error: null,
      }
    }

    const programmeResult = await createProgramme(blueprint.programme)
    if (programmeResult.error !== null || programmeResult.data === null) {
      console.error(
        '[programmeSeed.seedSummerMultipitchProgramme] createProgramme:',
        programmeResult.error,
      )
      return {
        data: null,
        error: programmeResult.error ?? 'Failed to create programme',
      }
    }

    let createdMesocycleCount = 0
    let createdWeeklyTemplateCount = 0
    let createdPlannedSessionCount = 0

    for (const mesocycle of blueprint.mesocycles) {
      const mesocycleResult = await createMesocycle({
        programme_id: programmeResult.data.id,
        name: mesocycle.name,
        focus: mesocycle.focus,
        phase_type: mesocycle.phaseType,
        planned_start: mesocycle.plannedStart,
        planned_end: mesocycle.plannedEnd,
        actual_start: null,
        actual_end: null,
        status: mesocycle.status,
        interruption_notes: null,
      } satisfies MesocycleInsert)

      if (mesocycleResult.error !== null || mesocycleResult.data === null) {
        console.error(
          '[programmeSeed.seedSummerMultipitchProgramme] createMesocycle:',
          mesocycleResult.error,
        )
        return {
          data: null,
          error: mesocycleResult.error ?? 'Failed to create mesocycle',
        }
      }

      createdMesocycleCount += 1
      const templateIdsByDay = new Map<number, string>()

      for (const template of mesocycle.templates) {
        const templateResult = await createWeeklyTemplate({
          mesocycle_id: mesocycleResult.data.id,
          day_of_week: template.dayOfWeek,
          session_label: template.sessionLabel,
          session_type: template.sessionType,
          intensity: template.intensity,
          duration_mins: template.durationMins,
          primary_focus: template.primaryFocus,
          notes: template.notes,
        } satisfies WeeklyTemplateInsert)

        if (templateResult.error !== null || templateResult.data === null) {
          console.error(
            '[programmeSeed.seedSummerMultipitchProgramme] createWeeklyTemplate:',
            templateResult.error,
          )
          return {
            data: null,
            error: templateResult.error ?? 'Failed to create weekly template',
          }
        }

        createdWeeklyTemplateCount += 1
        templateIdsByDay.set(template.dayOfWeek, templateResult.data.id)
      }

      if (mesocycle.status === 'active') {
        const plannedSessions = buildPlannedSessionsForMesocycle(
          mesocycleResult.data.id,
          mesocycle,
          templateIdsByDay,
        )

        for (const plannedSession of plannedSessions) {
          const plannedSessionResult = await createPlannedSession(plannedSession)
          if (
            plannedSessionResult.error !== null ||
            plannedSessionResult.data === null
          ) {
            console.error(
              '[programmeSeed.seedSummerMultipitchProgramme] createPlannedSession:',
              plannedSessionResult.error,
            )
            return {
              data: null,
              error:
                plannedSessionResult.error ?? 'Failed to create planned session',
            }
          }

          createdPlannedSessionCount += 1
        }
      }
    }

    return {
      data: {
        seeded: true,
        programmeId: programmeResult.data.id,
        programmeName: programmeResult.data.name,
        createdMesocycleCount,
        createdWeeklyTemplateCount,
        createdPlannedSessionCount,
      },
      error: null,
    }
  } catch (err) {
    console.error('[programmeSeed.seedSummerMultipitchProgramme] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}