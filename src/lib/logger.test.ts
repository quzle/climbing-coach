import { createStructuredLog, logError, logInfo, logWarn } from './logger'

describe('createStructuredLog', () => {
  it('returns stable snake_case fields with null defaults', () => {
    const log = createStructuredLog('info', {
      event: 'invite_sent',
      outcome: 'success',
    })

    expect(log).toMatchObject({
      level: 'info',
      event: 'invite_sent',
      user_id: null,
      profile_role: null,
      route: null,
      entity_type: null,
      entity_id: null,
      outcome: 'success',
      duration_ms: null,
      request_id: null,
      environment: 'test',
      data: null,
      error: null,
    })
    expect(log.timestamp).toEqual(expect.any(String))
  })

  it('sanitizes sensitive metadata and truncates long strings', () => {
    const longValue = 'x'.repeat(320)

    const log = createStructuredLog('warn', {
      event: 'chat_request',
      outcome: 'failure',
      data: {
        token: 'secret-token',
        nested: {
          prompt: 'sensitive prompt body',
          safeValue: longValue,
        },
        createdAt: new Date('2026-03-31T10:00:00.000Z'),
      },
    })

    expect(log.data).toEqual({
      token: '[REDACTED]',
      nested: {
        prompt: '[REDACTED]',
        safeValue: `${'x'.repeat(300)}...[truncated:20]`,
      },
      createdAt: '2026-03-31T10:00:00.000Z',
    })
  })

  it('serializes errors and hides stack traces in production', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const log = createStructuredLog('error', {
      event: 'repository_write_failure',
      outcome: 'failure',
      error: new Error('Insert failed'),
    })

    expect(log.error).toEqual({
      name: 'Error',
      message: 'Insert failed',
      stack: null,
    })

    process.env.NODE_ENV = originalNodeEnv
  })
})

describe('logger writers', () => {
  it('writes info logs to console.info', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined)

    const log = logInfo({
      event: 'login_success',
      outcome: 'success',
      userId: 'user-123',
    })

    expect(spy).toHaveBeenCalledWith(log)

    spy.mockRestore()
  })

  it('writes warn logs to console.warn', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const log = logWarn({
      event: 'ownership_denial',
      outcome: 'failure',
      userId: 'user-123',
    })

    expect(spy).toHaveBeenCalledWith(log)

    spy.mockRestore()
  })

  it('writes error logs to console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const log = logError({
      event: 'repository_write_failure',
      outcome: 'failure',
      error: new Error('boom'),
    })

    expect(spy).toHaveBeenCalledWith(log)

    spy.mockRestore()
  })
})