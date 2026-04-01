import { getActiveProgramme } from '@/services/data/programmeRepository'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import {
  getActiveMesocycle,
  getMesocyclesByProgramme,
} from '@/services/data/mesocycleRepository'
import { getWeeklyTemplateByMesocycle } from '@/services/data/weeklyTemplateRepository'
import { getUpcomingPlannedSessions } from '@/services/data/plannedSessionRepository'
import type { ApiResponse, ProgrammeBuilderSnapshot } from '@/types'

/**
 * @description Fetches the aggregated planning snapshot used by the programme builder.
 * It returns the active programme, all mesocycles within that programme, the
 * active mesocycle's weekly template, and upcoming planned sessions.
 *
 * @returns ProgrammeBuilderSnapshot with safe empty/null fallbacks
 */
export async function getProgrammeBuilderSnapshot(): Promise<
  ApiResponse<ProgrammeBuilderSnapshot>
> {
  try {
    const [activeProgrammeResult, activeMesocycleResult, upcomingSessionsResult] =
      await Promise.all([
        getActiveProgramme(SINGLE_USER_PLACEHOLDER_ID),
        getActiveMesocycle(),
        getUpcomingPlannedSessions(7),
      ])

    if (activeProgrammeResult.error !== null) {
      console.error(
        '[programmeService.getProgrammeBuilderSnapshot] getActiveProgramme:',
        activeProgrammeResult.error,
      )
    }
    if (activeMesocycleResult.error !== null) {
      console.error(
        '[programmeService.getProgrammeBuilderSnapshot] getActiveMesocycle:',
        activeMesocycleResult.error,
      )
    }
    if (upcomingSessionsResult.error !== null) {
      console.error(
        '[programmeService.getProgrammeBuilderSnapshot] getUpcomingPlannedSessions:',
        upcomingSessionsResult.error,
      )
    }

    const currentProgramme = activeProgrammeResult.data ?? null
    const activeMesocycle = activeMesocycleResult.data ?? null

    const [mesocyclesResult, templateResult] = await Promise.all([
      currentProgramme !== null
        ? getMesocyclesByProgramme(currentProgramme.id)
        : Promise.resolve({ data: [], error: null }),
      activeMesocycle !== null
        ? getWeeklyTemplateByMesocycle(activeMesocycle.id)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (mesocyclesResult.error !== null) {
      console.error(
        '[programmeService.getProgrammeBuilderSnapshot] getMesocyclesByProgramme:',
        mesocyclesResult.error,
      )
    }
    if (templateResult.error !== null) {
      console.error(
        '[programmeService.getProgrammeBuilderSnapshot] getWeeklyTemplateByMesocycle:',
        templateResult.error,
      )
    }

    return {
      data: {
        currentProgramme,
        activeMesocycle,
        mesocycles: mesocyclesResult.data ?? [],
        currentWeeklyTemplate: templateResult.data ?? [],
        upcomingPlannedSessions: upcomingSessionsResult.data ?? [],
      },
      error: null,
    }
  } catch (err) {
    console.error(
      '[programmeService.getProgrammeBuilderSnapshot] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}