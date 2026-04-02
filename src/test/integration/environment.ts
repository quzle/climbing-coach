type IntegrationEnvironment = {
  supabaseUrl: string
  anonKey: string
  serviceRoleKey: string
}

let cachedEnvironment: IntegrationEnvironment | null = null

function readRequiredVariable(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing ${name}. Set INTEGRATION_SUPABASE_URL, INTEGRATION_SUPABASE_ANON_KEY, and INTEGRATION_SUPABASE_SERVICE_ROLE_KEY before running npm run test:integration.`,
    )
  }

  return value
}

function validateSupabaseHost(supabaseUrl: string): void {
  const allowRemote = process.env.INTEGRATION_SUPABASE_ALLOW_REMOTE === 'true'
  const hostname = new URL(supabaseUrl).hostname
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'

  if (!allowRemote && !isLocalHost) {
    throw new Error(
      `Refusing to run integration tests against non-local Supabase host ${hostname}. Set INTEGRATION_SUPABASE_ALLOW_REMOTE=true only for an isolated test project.`,
    )
  }
}

/**
 * @description Returns the validated integration-test environment.
 * @returns Local Supabase connection details for integration tests.
 * @throws {Error} If required environment variables are missing or point to a non-local host.
 */
export function getIntegrationEnvironment(): IntegrationEnvironment {
  if (cachedEnvironment !== null) {
    return cachedEnvironment
  }

  const supabaseUrl = readRequiredVariable('INTEGRATION_SUPABASE_URL')
  const anonKey = readRequiredVariable('INTEGRATION_SUPABASE_ANON_KEY')
  const serviceRoleKey = readRequiredVariable('INTEGRATION_SUPABASE_SERVICE_ROLE_KEY')

  validateSupabaseHost(supabaseUrl)

  cachedEnvironment = {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  }

  return cachedEnvironment
}

/**
 * @description Maps the integration-test Supabase variables onto the application env names.
 * @returns The validated integration-test environment.
 */
export function applyIntegrationEnvironment(): IntegrationEnvironment {
  const environment = getIntegrationEnvironment()

  process.env.NEXT_PUBLIC_SUPABASE_URL = environment.supabaseUrl
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = environment.anonKey
  process.env.SUPABASE_SECRET_KEY = environment.serviceRoleKey

  return environment
}