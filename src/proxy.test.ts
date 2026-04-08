/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

// =============================================================================
// MOCKS
// =============================================================================

const mockGetUser = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

// =============================================================================
// HELPERS
// =============================================================================

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`)
}

// =============================================================================
// TESTS
// =============================================================================

describe('proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authenticated user', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      })
    })

    it('passes through requests to the home route', async () => {
      const response = await proxy(makeRequest('/'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /chat', async () => {
      const response = await proxy(makeRequest('/chat'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /profile', async () => {
      const response = await proxy(makeRequest('/profile'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /history', async () => {
      const response = await proxy(makeRequest('/history'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /programme', async () => {
      const response = await proxy(makeRequest('/programme'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /readiness', async () => {
      const response = await proxy(makeRequest('/readiness'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /session/log', async () => {
      const response = await proxy(makeRequest('/session/log'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /dev', async () => {
      const response = await proxy(makeRequest('/dev'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('passes through requests to /auth/login', async () => {
      const response = await proxy(makeRequest('/auth/login'))
      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('unauthenticated user', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })
    })

    it('redirects to /auth/login when accessing /', async () => {
      const response = await proxy(makeRequest('/'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing /chat', async () => {
      const response = await proxy(makeRequest('/chat'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing /profile', async () => {
      const response = await proxy(makeRequest('/profile'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing /history', async () => {
      const response = await proxy(makeRequest('/history'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing /programme', async () => {
      const response = await proxy(makeRequest('/programme'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing /readiness', async () => {
      const response = await proxy(makeRequest('/readiness'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing /session/log', async () => {
      const response = await proxy(makeRequest('/session/log'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing /dev', async () => {
      const response = await proxy(makeRequest('/dev'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('redirects to /auth/login when accessing an API route', async () => {
      const response = await proxy(makeRequest('/api/sessions'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/login')
    })

    it('allows access to /auth/login without redirecting', async () => {
      const response = await proxy(makeRequest('/auth/login'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('allows access to /auth/callback without redirecting', async () => {
      const response = await proxy(makeRequest('/auth/callback'))
      expect(response.headers.get('location')).toBeNull()
    })

    it('allows access to /auth/confirm without redirecting', async () => {
      const response = await proxy(makeRequest('/auth/confirm'))
      expect(response.headers.get('location')).toBeNull()
    })
  })
})
