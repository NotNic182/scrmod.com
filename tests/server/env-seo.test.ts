import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { parseEnv, type Env } from '../../src/server/env'
import { basePrefix, siteUrl } from '../../src/server/seo/site'

/** siteUrl() as a route sees it, for a request to `url`. */
async function siteOf(env: Env, url: string, headers?: Record<string, string>): Promise<string> {
  const app = new Hono()
  app.get('*', (c) => c.text(siteUrl(env, c)))
  return (await app.request(url, headers ? { headers } : undefined)).text()
}

describe('SEO and stream settings', () => {
  it('defaults the stream channels and leaves keys unset', () => {
    const env = parseEnv({})
    expect(env.stream).toEqual({ twitchLogin: 'sidscompetitiverounds', youtubeChannelId: 'UCz9MIFturPcCSJsFFzgyBxw', twitchClientId: undefined, twitchClientSecret: undefined, youtubeApiKey: undefined })
    expect(env.googleVerification).toBeUndefined()
  })

  it('reads keys and verification codes', () => {
    const env = parseEnv({ TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret', YOUTUBE_API_KEY: 'yt', STREAM_TWITCH_LOGIN: 'other', GOOGLE_SITE_VERIFICATION: 'g', BING_SITE_VERIFICATION: 'b' })
    expect(env.stream).toMatchObject({ twitchLogin: 'other', twitchClientId: 'id', twitchClientSecret: 'secret', youtubeApiKey: 'yt' })
    expect(env.googleVerification).toBe('g')
    expect(env.bingVerification).toBe('b')
  })

  it('builds the site URL from PUBLIC_BASE_URL, else the request, plus the base path', async () => {
    expect(await siteOf(parseEnv({ PUBLIC_BASE_URL: 'https://scrmod.com' }), 'http://x.up.railway.app/cards')).toBe('https://scrmod.com')
    expect(await siteOf(parseEnv({}), 'http://localhost:8080/cards')).toBe('http://localhost:8080')
    expect(await siteOf(parseEnv({ BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' }), 'http://a/hub/')).toBe('https://example.org/hub')
    expect(basePrefix(parseEnv({ BASE_PATH: '/hub' }))).toBe('/hub')
    expect(basePrefix(parseEnv({}))).toBe('')
  })

  it('takes the scheme from x-forwarded-proto: behind a TLS proxy the request itself arrives as http', async () => {
    expect(await siteOf(parseEnv({}), 'http://x.up.railway.app/cards', { 'x-forwarded-proto': 'https' })).toBe('https://x.up.railway.app')
    expect(await siteOf(parseEnv({}), 'http://x.up.railway.app/cards', { 'x-forwarded-proto': 'https, http' })).toBe('https://x.up.railway.app')
    expect(await siteOf(parseEnv({}), 'http://x.up.railway.app/cards', { 'x-forwarded-proto': 'http' })).toBe('http://x.up.railway.app')
  })

  it('ignores a PUBLIC_BASE_URL that is not an absolute http(s) URL', async () => {
    const railway = { 'x-forwarded-proto': 'https' }
    expect(await siteOf(parseEnv({ PUBLIC_BASE_URL: 'scrmod.com' }), 'http://x.up.railway.app/cards', railway)).toBe('https://x.up.railway.app')
    expect(await siteOf(parseEnv({ PUBLIC_BASE_URL: 'scrmod.com:443' }), 'http://x.up.railway.app/cards', railway)).toBe('https://x.up.railway.app')
    expect(await siteOf(parseEnv({ PUBLIC_BASE_URL: 'ftp://scrmod.com' }), 'http://x.up.railway.app/cards', railway)).toBe('https://x.up.railway.app')
  })
})
