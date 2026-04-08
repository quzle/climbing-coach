import { NextRequest } from 'next/server'
import { POST } from '@/app/api/invites/route'
import {
  createIntegrationHarness,
  type IntegrationTestUser,
} from '@/test/integration/supabase-test-harness'

describe('POST /api/invites integration', () => {
  const harness = createIntegrationHarness('invites-route')

  let regularUser: IntegrationTestUser

  beforeAll(async () => {
    await harness.assertConnectivity()
    regularUser = await harness.createUser({ label: 'regular-user', role: 'user' })
  })

  afterAll(async () => {
    await harness.cleanup()
  })

  it('returns 403 for authenticated users without the superuser role', async () => {
    await harness.authenticateRouteRequest(regularUser)

    const request = new NextRequest('http://localhost/api/invites', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'target@example.com' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: 'Forbidden.',
    })
  })
})