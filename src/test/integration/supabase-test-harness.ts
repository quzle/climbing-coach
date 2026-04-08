import { createServerClient } from '@supabase/ssr'
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getIntegrationEnvironment } from '@/test/integration/environment'
import { setMockCookies, type MockCookie } from '@/test/integration/mock-cookie-store'

type TestUserRole = 'user' | 'superuser'

export type IntegrationTestUser = {
  id: string
  email: string
  password: string
  role: TestUserRole
  session: Session
}

type UserFixtureInput = {
  label: string
  role?: TestUserRole
}

type CookieAccumulator = {
  cookies: MockCookie[]
}

function upsertCookie(accumulator: CookieAccumulator, cookie: MockCookie): void {
  const index = accumulator.cookies.findIndex((entry) => entry.name === cookie.name)

  if (index === -1) {
    accumulator.cookies.push(cookie)
    return
  }

  accumulator.cookies[index] = cookie
}

/**
 * @description Creates the privileged Supabase client used for integration setup and teardown.
 * @returns Service-role Supabase client for test data management.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  const environment = getIntegrationEnvironment()

  return createClient<Database>(environment.supabaseUrl, environment.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * @description Creates an anon-key Supabase client that authenticates as the supplied user session.
 * @param session Real Supabase session used for RLS-protected queries.
 * @returns Authenticated anon-key client.
 */
export function createAuthenticatedAnonClient(
  session: Session,
): SupabaseClient<Database> {
  const environment = getIntegrationEnvironment()

  return createClient<Database>(environment.supabaseUrl, environment.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  })
}

async function buildServerAuthCookies(session: Session): Promise<MockCookie[]> {
  const environment = getIntegrationEnvironment()
  const accumulator: CookieAccumulator = { cookies: [] }

  const client = createServerClient(environment.supabaseUrl, environment.anonKey, {
    cookies: {
      getAll() {
        return accumulator.cookies.map(({ name, value }) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          upsertCookie(accumulator, {
            name: cookie.name,
            value: cookie.value,
            options: cookie.options,
          })
        }
      },
    },
  })

  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  if (error) {
    throw error
  }

  return accumulator.cookies
}

async function signInWithPassword(email: string, password: string): Promise<Session> {
  const environment = getIntegrationEnvironment()
  const client = createClient<Database>(environment.supabaseUrl, environment.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error || data.session === null) {
    throw error ?? new Error(`Failed to sign in integration user ${email}.`)
  }

  return data.session
}

async function createAuthUser(
  client: SupabaseClient<Database>,
  email: string,
  password: string,
): Promise<User> {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || data.user === null) {
    throw error ?? new Error(`Failed to create integration auth user ${email}.`)
  }

  return data.user
}

async function upsertProfile(
  client: SupabaseClient<Database>,
  user: User,
  role: TestUserRole,
): Promise<void> {
  const { error } = await client.from('profiles').upsert({
    id: user.id,
    email: user.email ?? '',
    role,
    invite_status: 'active',
    display_name: null,
  })

  if (error) {
    throw error
  }
}

/**
 * @description Creates an isolated integration-test harness for local Supabase auth and data setup.
 * @param scope Label used to generate unique test-user emails.
 * @returns Helpers for user creation, request authentication, seeding, and teardown.
 */
export function createIntegrationHarness(scope: string): {
  assertConnectivity: () => Promise<void>
  createUser: (input: UserFixtureInput) => Promise<IntegrationTestUser>
  authenticateRouteRequest: (user: IntegrationTestUser) => Promise<void>
  insertProgramme: (userId: string, name: string) => Promise<void>
  insertChatThread: (userId: string, title: string) => Promise<void>
  cleanup: () => Promise<void>
} {
  const serviceClient = createServiceRoleClient()
  const createdUsers: IntegrationTestUser[] = []
  const runId = `${scope}-${Date.now()}`

  return {
    async assertConnectivity(): Promise<void> {
      const { error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1 })

      if (error) {
        throw error
      }
    },

    async createUser(input: UserFixtureInput): Promise<IntegrationTestUser> {
      const role = input.role ?? 'user'
      const email = `integration-${runId}-${input.label}@example.com`
      const password = 'IntegrationPass123!'
      const authUser = await createAuthUser(serviceClient, email, password)

      await upsertProfile(serviceClient, authUser, role)

      const session = await signInWithPassword(email, password)
      const user = {
        id: authUser.id,
        email,
        password,
        role,
        session,
      }

      createdUsers.push(user)

      return user
    },

    async authenticateRouteRequest(user: IntegrationTestUser): Promise<void> {
      const cookies = await buildServerAuthCookies(user.session)
      setMockCookies(cookies)
    },

    async insertProgramme(userId: string, name: string): Promise<void> {
      const { error } = await serviceClient.from('programmes').insert({
        user_id: userId,
        name,
        goal: 'Integration goal',
        start_date: '2026-04-01',
        target_date: '2026-05-01',
        status: 'active',
        notes: null,
      })

      if (error) {
        throw error
      }
    },

    async insertChatThread(userId: string, title: string): Promise<void> {
      const { error } = await serviceClient.from('chat_threads').insert({
        user_id: userId,
        title,
      })

      if (error) {
        throw error
      }
    },

    async cleanup(): Promise<void> {
      if (createdUsers.length === 0) {
        return
      }

      const userIds = createdUsers.map((user) => user.id)

      await serviceClient.from('chat_messages').delete().in('user_id', userIds)
      await serviceClient.from('chat_threads').delete().in('user_id', userIds)
      await serviceClient.from('session_logs').delete().in('user_id', userIds)
      await serviceClient.from('readiness_checkins').delete().in('user_id', userIds)
      await serviceClient.from('injury_areas').delete().in('user_id', userIds)
      await serviceClient.from('planned_sessions').delete().in('user_id', userIds)
      await serviceClient.from('weekly_templates').delete().in('user_id', userIds)
      await serviceClient.from('mesocycles').delete().in('user_id', userIds)
      await serviceClient.from('programmes').delete().in('user_id', userIds)
      await serviceClient.from('profiles').delete().in('id', userIds)

      for (const user of createdUsers) {
        await serviceClient.auth.admin.deleteUser(user.id)
      }

      createdUsers.length = 0
    },
  }
}