import { applyIntegrationEnvironment } from '@/test/integration/environment'
import { clearMockCookies, getCookieStore } from '@/test/integration/mock-cookie-store'

applyIntegrationEnvironment()

jest.setTimeout(30_000)

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => getCookieStore()),
}))

afterEach(() => {
  clearMockCookies()
})