/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import {
  getActiveInjuryAreas,
  addInjuryArea,
} from '@/services/data/injuryAreasRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { GET, POST } from './route'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/services/data/injuryAreasRepository', () => ({
  getActiveInjuryAreas: jest.fn(),
  addInjuryArea: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

const mockGetActiveInjuryAreas = getActiveInjuryAreas as jest.Mock
const mockAddInjuryArea = addInjuryArea as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

// =============================================================================
// FIXTURES
// =============================================================================

const mockArea = {
  id: 'area-uuid-1',
  area: 'shoulder_left',
  is_active: true,
  added_at: '2026-03-25T10:00:00Z',
  archived_at: null,
}

// =============================================================================
// SETUP
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mockGetActiveInjuryAreas.mockResolvedValue({ data: [mockArea], error: null })
  mockAddInjuryArea.mockResolvedValue({ data: mockArea, error: null })
})

// =============================================================================
// HELPERS
// =============================================================================

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/injury-areas', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/injury-areas', () => {
  it('returns 200 with active injury areas', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetActiveInjuryAreas).toHaveBeenCalledWith('user-1')
    expect(body.data).toEqual([mockArea])
    expect(body.error).toBeNull()
  })

  it('returns empty array when no areas are tracked', async () => {
    mockGetActiveInjuryAreas.mockResolvedValue({ data: [], error: null })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('returns 500 when repository fails', async () => {
    mockGetActiveInjuryAreas.mockResolvedValue({ data: null, error: 'DB error' })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toContain('Failed to fetch')
  })
})

describe('POST /api/injury-areas', () => {
  it('returns 201 with the created area on valid request', async () => {
    const response = await POST(makePostRequest({ area: 'shoulder_left' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data).toEqual(mockArea)
    expect(body.error).toBeNull()
  })

  it('calls addInjuryArea with the validated area name', async () => {
    await POST(makePostRequest({ area: 'wrist_right' }))

    expect(mockAddInjuryArea).toHaveBeenCalledWith('wrist_right', 'user-1')
  })

  it('returns 400 when area field is missing', async () => {
    const response = await POST(makePostRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid request')
  })

  it('returns 400 when area is an empty string', async () => {
    const response = await POST(makePostRequest({ area: '' }))
    const body = await response.json()

    expect(response.status).toBe(400)
  })

  it('returns 500 when repository fails', async () => {
    mockAddInjuryArea.mockResolvedValue({ data: null, error: 'DB error' })

    const response = await POST(makePostRequest({ area: 'knee_left' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toContain('Failed to add')
  })
})
