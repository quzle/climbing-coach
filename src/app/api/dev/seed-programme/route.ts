import { NextResponse } from 'next/server'
import {
  seedSummerMultipitchProgramme,
  type SeedProgrammeResult,
} from '@/services/training/programmeSeed'
import type { ApiResponse } from '@/types'

/**
 * @description Seeds a deterministic Phase 2F starter programme for development and local testing.
 * This route is intentionally disabled in production.
 * @returns Creation summary for the seeded programme tree.
 */
export async function POST(): Promise<
  NextResponse<ApiResponse<SeedProgrammeResult>>
> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ data: null, error: 'Not found.' }, { status: 404 })
  }

  try {
    const result = await seedSummerMultipitchProgramme()

    if (result.error !== null || result.data === null) {
      console.error('[POST /api/dev/seed-programme]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to seed programme data.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: result.data, error: null }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/dev/seed-programme]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to seed programme data.' },
      { status: 500 },
    )
  }
}