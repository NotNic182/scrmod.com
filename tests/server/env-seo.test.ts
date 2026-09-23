import { describe, it, expect } from 'vitest'
import { parseEnv } from '../../src/server/env'
import { basePrefix, siteUrl } from '../../src/server/seo/site'

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

  it('builds the site URL from PUBLIC_BASE_URL, else the request, plus the base path', () => {
    expect(siteUrl(parseEnv({ PUBLIC_BASE_URL: 'https://scrmod.com' }), 'http://x.up.railway.app/cards')).toBe('https://scrmod.com')
    expect(siteUrl(parseEnv({}), 'http://localhost:8080/cards')).toBe('http://localhost:8080')
    expect(siteUrl(parseEnv({ BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' }), 'http://a/hub/')).toBe('https://example.org/hub')
    expect(basePrefix(parseEnv({ BASE_PATH: '/hub' }))).toBe('/hub')
    expect(basePrefix(parseEnv({}))).toBe('')
  })
})
