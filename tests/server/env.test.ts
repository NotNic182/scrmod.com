import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_UPSTREAM, modeOf, parseEnv } from '../../src/server/env'

describe('parseEnv', () => {
  it('reduces PUBLIC_BASE_URL to an origin whether or not BASE_PATH is already on it', () => {
    expect(parseEnv({ PUBLIC_BASE_URL: 'https://hub.test', BASE_PATH: '/hub' }).publicBaseUrl).toBe('https://hub.test')
    expect(parseEnv({ PUBLIC_BASE_URL: 'https://hub.test/hub', BASE_PATH: '/hub' }).publicBaseUrl).toBe('https://hub.test')
    expect(parseEnv({ PUBLIC_BASE_URL: 'https://hub.test/hub/', BASE_PATH: '/hub/' }).publicBaseUrl).toBe('https://hub.test')
    // Spec 9.2's own compose snippet.
    expect(
      parseEnv({ PUBLIC_BASE_URL: 'https://competitive-rounds.duckdns.org:8444/hub', BASE_PATH: '/hub/' }).publicBaseUrl,
    ).toBe('https://competitive-rounds.duckdns.org:8444')
  })

  it('leaves a URL alone when its path is not the base path', () => {
    expect(parseEnv({ PUBLIC_BASE_URL: 'https://hub.test/site', BASE_PATH: '/hub' }).publicBaseUrl).toBe('https://hub.test/site')
    expect(parseEnv({ PUBLIC_BASE_URL: 'https://hub.test' }).publicBaseUrl).toBe('https://hub.test')
    expect(parseEnv({ PUBLIC_BASE_URL: 'https://hub', BASE_PATH: '/hub' }).publicBaseUrl).toBe('https://hub')
    expect(parseEnv({ PUBLIC_BASE_URL: 'not a url', BASE_PATH: '/hub' }).publicBaseUrl).toBe('not a url')
  })

  it('carries the origin into the User-Agent (spec 6.2)', () => {
    expect(parseEnv({ PUBLIC_BASE_URL: 'https://hub.test/hub', BASE_PATH: '/hub' }).userAgent).toBe('scr-hub/0.1.0 (+https://hub.test)')
    expect(parseEnv({}).userAgent).toBe('scr-hub/0.1.0')
  })

  it('disables sign-in with a loud warning when SESSION_SECRET is too short', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = parseEnv({ DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'sec', SESSION_SECRET: 'short' })
    expect(env.discord).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('SESSION_SECRET')
    warn.mockRestore()
  })

  it('enables sign-in from 32 characters and warns about nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const secret = 'x'.repeat(32)
    const env = parseEnv({ DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'sec', SESSION_SECRET: secret })
    expect(env.discord).toEqual({ clientId: 'cid', clientSecret: 'sec', sessionSecret: secret })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('says nothing when Discord is simply not configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseEnv({ SESSION_SECRET: 'short' }).discord).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('routes the web root and the listen port through the env', () => {
    expect(parseEnv({}).webRoot).toBe('dist/web')
    expect(parseEnv({}).port).toBe(8080)
    expect(parseEnv({ SCR_WEB_ROOT: '/app/dist/web' }).webRoot).toBe('/app/dist/web')
    expect(parseEnv({ PORT: '3000' }).port).toBe(3000)
    expect(parseEnv({ PORT: 'nope' }).port).toBe(8080)
    expect(parseEnv({ PORT: '99999' }).port).toBe(8080)
  })

  it('still reports the defaults and the mode', () => {
    expect(parseEnv({}).upstreamBase).toBe(DEFAULT_UPSTREAM)
    expect(modeOf(parseEnv({}))).toBe('community')
    expect(modeOf(parseEnv({ SCR_INTERNAL_KEY: 'k' }))).toBe('hosted')
    expect(modeOf(parseEnv({ SCR_FIXTURES: '1' }))).toBe('fixtures')
  })
})
