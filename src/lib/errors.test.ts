/**
 * @jest-environment node
 */
import {
  AuthorizationCheckError,
  ForbiddenError,
  UnauthenticatedError,
  handleRouteAuthError,
} from './errors'

describe('handleRouteAuthError', () => {
  it('returns a 401 response for unauthenticated errors', async () => {
    const result = handleRouteAuthError(new UnauthenticatedError())

    expect(result?.reason).toBe('unauthenticated')
    expect(result?.response.status).toBe(401)
    await expect(result?.response.json()).resolves.toEqual({
      data: null,
      error: 'Unauthenticated.',
    })
  })

  it('supports custom unauthenticated messages', async () => {
    const result = handleRouteAuthError(new UnauthenticatedError(), {
      unauthenticatedMessage: 'Authentication required.',
    })

    expect(result?.reason).toBe('unauthenticated')
    expect(result?.response.status).toBe(401)
    await expect(result?.response.json()).resolves.toEqual({
      data: null,
      error: 'Authentication required.',
    })
  })

  it('returns a 403 response for forbidden errors', async () => {
    const result = handleRouteAuthError(new ForbiddenError())

    expect(result?.reason).toBe('forbidden')
    expect(result?.response.status).toBe(403)
    await expect(result?.response.json()).resolves.toEqual({
      data: null,
      error: 'Forbidden.',
    })
  })

  it('returns null for authorization check failures', () => {
    expect(handleRouteAuthError(new AuthorizationCheckError())).toBeNull()
  })

  it('returns null for non-auth errors', () => {
    expect(handleRouteAuthError(new Error('boom'))).toBeNull()
  })
})