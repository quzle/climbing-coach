type LogLevel = 'info' | 'warn' | 'error'

type LogOutcome = 'success' | 'failure'

type StructuredLogError = {
  name: string
  message: string
  stack: string | null
}

export type LoggerInput = {
  event: string
  outcome: LogOutcome
  userId?: string | null
  profileRole?: string | null
  route?: string | null
  entityType?: string | null
  entityId?: string | null
  durationMs?: number | null
  requestId?: string | null
  environment?: string | null
  data?: Record<string, unknown>
  error?: unknown
}

export type StructuredLog = {
  timestamp: string
  level: LogLevel
  event: string
  user_id: string | null
  profile_role: string | null
  route: string | null
  entity_type: string | null
  entity_id: string | null
  outcome: LogOutcome
  duration_ms: number | null
  request_id: string | null
  environment: string
  data: Record<string, unknown> | null
  error: StructuredLogError | null
}

const REDACTED_VALUE = '[REDACTED]'
const MAX_STRING_LENGTH = 300
const MAX_ARRAY_LENGTH = 25
const SENSITIVE_KEY_NAMES = new Set([
  'accesstoken',
  'apikey',
  'authorization',
  'chatmessage',
  'chatmessages',
  'content',
  'cookie',
  'messagebody',
  'password',
  'prompt',
  'rawtext',
  'refreshtoken',
  'responsebody',
  'responsetext',
  'secret',
  'setcookie',
  'token',
])

function normalizeKeyName(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_NAMES.has(normalizeKeyName(key))
}

function sanitizeString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length - MAX_STRING_LENGTH}]`
}

function sanitizeUnknown(value: unknown, parentKey?: string): unknown {
  if (parentKey && isSensitiveKey(parentKey)) {
    return REDACTED_VALUE
  }

  if (value === null) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return serializeError(value)
  }

  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeUnknown(item))
  }

  if (typeof value === 'object') {
    return sanitizeMetadata(value as Record<string, unknown>)
  }

  return value
}

function sanitizeMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const sanitizedEntries = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, sanitizeUnknown(value, key)] as const)

  return Object.fromEntries(sanitizedEntries)
}

function getEnvironment(environment?: string | null): string {
  if (environment) {
    return environment
  }

  return process.env.NODE_ENV ?? 'development'
}

function serializeError(error: unknown): StructuredLogError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeString(error.message),
      stack: process.env.NODE_ENV === 'production' ? null : error.stack ?? null,
    }
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: sanitizeString(error),
      stack: null,
    }
  }

  if (error && typeof error === 'object') {
    return {
      name: 'UnknownError',
      message: 'Unknown error',
      stack: null,
    }
  }

  return {
    name: 'UnknownError',
    message: 'Unknown error',
    stack: null,
  }
}

function createLogEntry(level: LogLevel, input: LoggerInput): StructuredLog {
  const data = input.data ? sanitizeMetadata(input.data) : null

  return {
    timestamp: new Date().toISOString(),
    level,
    event: input.event,
    user_id: input.userId ?? null,
    profile_role: input.profileRole ?? null,
    route: input.route ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    outcome: input.outcome,
    duration_ms: input.durationMs ?? null,
    request_id: input.requestId ?? null,
    environment: getEnvironment(input.environment),
    data: data && Object.keys(data).length > 0 ? data : null,
    error: input.error ? serializeError(input.error) : null,
  }
}

function writeLog(level: LogLevel, input: LoggerInput): StructuredLog {
  const entry = createLogEntry(level, input)

  if (level === 'info') {
    console.info(entry)
  } else if (level === 'warn') {
    console.warn(entry)
  } else {
    console.error(entry)
  }

  return entry
}

/**
 * @description Builds a structured log entry with stable field names and sanitized metadata.
 * @param level The log severity level.
 * @param input The event details and optional metadata to serialize.
 * @returns A structured log object ready for emission.
 * @throws This function does not throw.
 */
export function createStructuredLog(level: LogLevel, input: LoggerInput): StructuredLog {
  return createLogEntry(level, input)
}

/**
 * @description Emits an info-level structured log entry.
 * @param input The event details and optional metadata to serialize.
 * @returns The structured log entry that was written.
 * @throws This function does not throw.
 */
export function logInfo(input: LoggerInput): StructuredLog {
  return writeLog('info', input)
}

/**
 * @description Emits a warn-level structured log entry.
 * @param input The event details and optional metadata to serialize.
 * @returns The structured log entry that was written.
 * @throws This function does not throw.
 */
export function logWarn(input: LoggerInput): StructuredLog {
  return writeLog('warn', input)
}

/**
 * @description Emits an error-level structured log entry.
 * @param input The event details and optional metadata to serialize.
 * @returns The structured log entry that was written.
 * @throws This function does not throw.
 */
export function logError(input: LoggerInput): StructuredLog {
  return writeLog('error', input)
}