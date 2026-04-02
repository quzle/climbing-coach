export type MockCookie = {
  name: string
  value: string
  options?: Record<string, unknown>
}

const cookieState = new Map<string, MockCookie>()

/**
 * @description Returns the mutable cookie store used by integration tests to back next/headers cookies().
 * @returns Cookie store compatible with the server Supabase client.
 */
export function getCookieStore(): {
  getAll: () => Array<{ name: string; value: string }>
  set: (name: string, value: string, options?: Record<string, unknown>) => void
} {
  return {
    getAll: () =>
      Array.from(cookieState.values()).map(({ name, value }) => ({
        name,
        value,
      })),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieState.set(name, { name, value, options })
    },
  }
}

/**
 * @description Replaces the current mock request cookies with the provided values.
 * @param cookies Cookie values generated for the current test request.
 */
export function setMockCookies(cookies: MockCookie[]): void {
  cookieState.clear()

  for (const cookie of cookies) {
    cookieState.set(cookie.name, cookie)
  }
}

/**
 * @description Clears all mock request cookies after a test completes.
 */
export function clearMockCookies(): void {
  cookieState.clear()
}