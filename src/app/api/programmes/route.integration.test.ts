import { GET } from '@/app/api/programmes/route'
import { clearMockCookies } from '@/test/integration/mock-cookie-store'
import {
  createIntegrationHarness,
  type IntegrationTestUser,
} from '@/test/integration/supabase-test-harness'

describe('GET /api/programmes integration', () => {
  const harness = createIntegrationHarness('programmes-route')

  let alice: IntegrationTestUser
  let bob: IntegrationTestUser

  beforeAll(async () => {
    await harness.assertConnectivity()
    alice = await harness.createUser({ label: 'alice' })
    bob = await harness.createUser({ label: 'bob' })
  })

  afterAll(async () => {
    await harness.cleanup()
  })

  beforeEach(() => {
    clearMockCookies()
  })

  it('returns 401 when the request has no authenticated Supabase session', async () => {
    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: 'Unauthenticated.',
    })
  })

  it('returns only the authenticated user programmes', async () => {
    await harness.insertProgramme(alice.id, 'Alice programme')
    await harness.insertProgramme(bob.id, 'Bob programme')
    await harness.authenticateRouteRequest(alice)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      data: {
        programmes: [
          expect.objectContaining({
            name: 'Alice programme',
            user_id: alice.id,
          }),
        ],
      },
      error: null,
    })
  })
})