import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types'

/**
 * @description Error thrown when no authenticated Supabase session is available.
 */
export class UnauthenticatedError extends Error {
  constructor(message = 'Unauthenticated') {
    super(message)
    this.name = 'UnauthenticatedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * @description Error thrown when an authenticated user lacks permission for an action.
 */
export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * @description Error thrown when the server cannot verify authorization state safely.
 */
export class AuthorizationCheckError extends Error {
  constructor(message = 'Authorization check failed') {
    super(message)
    this.name = 'AuthorizationCheckError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export type RouteAuthErrorReason = 'unauthenticated' | 'forbidden'

export type RouteAuthErrorResult = {
  reason: RouteAuthErrorReason
  response: NextResponse<ApiResponse<never>>
}

type RouteAuthErrorOptions = {
  unauthenticatedMessage?: string
  forbiddenMessage?: string
}

function createAuthErrorResponse(
  message: string,
  status: 401 | 403,
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ data: null, error: message }, { status })
}

/**
 * @description Maps typed auth errors thrown by server auth helpers to route responses.
 * Authorization check failures intentionally fall through so callers return their normal 500 path.
 * @param error Potential auth-related error thrown while resolving route auth context.
 * @param options Optional client-facing message overrides for route-specific wording.
 * @returns Route auth error response metadata, or null when the caller should treat the error as non-auth-related.
 */
export function handleRouteAuthError(
  error: unknown,
  options: RouteAuthErrorOptions = {},
): RouteAuthErrorResult | null {
  if (error instanceof UnauthenticatedError) {
    return {
      reason: 'unauthenticated',
      response: createAuthErrorResponse(
        options.unauthenticatedMessage ?? 'Unauthenticated.',
        401,
      ),
    }
  }

  if (error instanceof ForbiddenError) {
    return {
      reason: 'forbidden',
      response: createAuthErrorResponse(options.forbiddenMessage ?? 'Forbidden.', 403),
    }
  }

  if (error instanceof AuthorizationCheckError) {
    return null
  }

  return null
}