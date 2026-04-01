/** @jest-environment node */
import { DELETE } from './route'
import { getCurrentUser } from '@/lib/supabase/get-current-user'

jest.mock('@/services/data/injuryAreasRepository', () => ({
  archiveInjuryArea: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

import { archiveInjuryArea } from '@/services/data/injuryAreasRepository'

const mockArchiveInjuryArea = archiveInjuryArea as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

function makeParams(area: string): { params: Promise<{ area: string }> } {
  return { params: Promise.resolve({ area }) }
}

function makeRow(area: string) {
  return {
    id: `id-${area}`,
    area,
    is_active: false,
    added_at: '2024-01-01T00:00:00Z',
    archived_at: '2024-06-01T00:00:00Z',
    user_id: 'user-1',
  }
}

describe('DELETE /api/injury-areas/[area]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  })

  it('archives the area and returns 200 with the updated row', async () => {
    const row = makeRow('shoulder_left')
    mockArchiveInjuryArea.mockResolvedValue({ data: row, error: null })

    const response = await DELETE(new Request('http://localhost'), makeParams('shoulder_left'))
    const body = await response.json()

    expect(mockArchiveInjuryArea).toHaveBeenCalledWith('shoulder_left', 'user-1')
    expect(response.status).toBe(200)
    expect(body).toEqual({ data: row, error: null })
  })

  it('decodes the area param from the route segment', async () => {
    const row = makeRow('finger_a2_left')
    mockArchiveInjuryArea.mockResolvedValue({ data: row, error: null })

    await DELETE(new Request('http://localhost'), makeParams('finger_a2_left'))

    expect(mockArchiveInjuryArea).toHaveBeenCalledWith('finger_a2_left', 'user-1')
  })

  it('returns 500 when repository returns an error', async () => {
    mockArchiveInjuryArea.mockResolvedValue({ data: null, error: 'DB error' })

    const response = await DELETE(new Request('http://localhost'), makeParams('shoulder_left'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to archive injury area.' })
  })

  it('returns 500 on unexpected exception', async () => {
    mockArchiveInjuryArea.mockRejectedValue(new Error('Unexpected'))

    const response = await DELETE(new Request('http://localhost'), makeParams('shoulder_left'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to archive injury area.' })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Unauthenticated'))

    const response = await DELETE(new Request('http://localhost'), makeParams('shoulder_left'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockArchiveInjuryArea).not.toHaveBeenCalled()
  })
})
