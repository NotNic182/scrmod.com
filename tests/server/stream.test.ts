import { describe, it, expect, vi, afterEach } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { parseYouTubeFeed } from '../../src/server/stream'

const FEED = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><title>Sid's Competitive Rounds</title>
${[1, 2, 3, 4, 5].map((i) => `<entry><yt:videoId>vid${i}</yt:videoId><title>Spirit &amp; galaxy ice #${i}</title><published>2026-09-2${i}T07:06:15+00:00</published></entry>`).join('')}</feed>`

type Route = (url: URL, init?: RequestInit) => Response
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = []
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    calls.push(`${url.host}${url.pathname}`)
    const hit = routes[`${url.host}${url.pathname}`]
    return hit ? hit(url, init) : new Response('nope', { status: 404 })
  }) as unknown as typeof fetch
  return { impl, calls }
}
const ok = (body: unknown) => () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 })
const feed = { 'www.youtube.com/feeds/videos.xml': ok(FEED) }
const token = { 'id.twitch.tv/oauth2/token': ok({ access_token: 't1', expires_in: 3600 }) }
const TWITCH_ENV = { TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'sec' }

async function stream(env: Record<string, string>, routes: Record<string, Route>, nowRef = { now: 1_000_000 }) {
  const f = fakeFetch(routes)
  const { app } = makeApp({}, env, nowRef, undefined, f.impl)
  return { get: async () => (await (await app.request('/api/stream')).json()).data, raw: () => app.request('/api/stream'), calls: f.calls, nowRef }
}

/** Silences the console for the rest of the test (stream outages are logged) and reads back what was written. */
function captureConsole() {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
  return {
    /** The stream's own warnings (the rate limiter also warns once here: these requests carry no client address). */
    streamWarnings: () => spies[2].mock.calls.filter((c) => String(c[0]).startsWith('[stream]')),
    text: () => spies.flatMap((s) => s.mock.calls.flat()).map((a) => (a instanceof Error ? `${a.name} ${a.message} ${a.stack}` : String(a))).join('\n'),
  }
}

describe('parseYouTubeFeed', () => {
  it('reads id, decoded title, link and date for each entry, not the channel title', () => {
    const v = parseYouTubeFeed(FEED)
    expect(v).toHaveLength(5)
    expect(v[0]).toEqual({ videoId: 'vid1', title: 'Spirit & galaxy ice #1', url: 'https://www.youtube.com/watch?v=vid1', published_at: '2026-09-21T07:06:15+00:00' })
  })
})

describe('/api/stream', () => {
  afterEach(() => vi.restoreAllMocks())

  it('without keys: offline, with the 4 latest broadcasts and the channel links', async () => {
    const s = await stream({}, feed)
    const d = await s.get()
    expect(d.live).toBeNull()
    expect(d.recent.map((v: { videoId: string }) => v.videoId)).toEqual(['vid1', 'vid2', 'vid3', 'vid4'])
    expect(d.links).toEqual({ twitch: 'https://www.twitch.tv/sidscompetitiverounds', youtube: 'https://www.youtube.com/@SidsCompetitiveRounds' })
    expect(s.calls.some((c) => c.includes('twitch'))).toBe(false)
  })

  it('Twitch live: reports the stream and reuses its token', async () => {
    const s = await stream(TWITCH_ENV, {
      ...feed,
      ...token,
      'api.twitch.tv/helix/streams': (url, init) => {
        expect(url.searchParams.get('user_login')).toBe('sidscompetitiverounds')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer t1')
        return new Response(JSON.stringify({ data: [{ type: 'live', title: 'Ranked night', viewer_count: 42, started_at: '2026-09-23T18:00:00Z' }] }))
      },
    })
    expect((await s.get()).live).toEqual({ platform: 'twitch', title: 'Ranked night', viewers: 42, started_at: '2026-09-23T18:00:00Z', url: 'https://www.twitch.tv/sidscompetitiverounds', embed: { kind: 'twitch', channel: 'sidscompetitiverounds' } })
    await s.get() // within 60 s: from the cache
    expect(s.calls.filter((c) => c === 'api.twitch.tv/helix/streams')).toHaveLength(1)
    s.nowRef.now += 61_000
    await s.get()
    expect(s.calls.filter((c) => c === 'id.twitch.tv/oauth2/token')).toHaveLength(1)
    expect(s.calls.filter((c) => c === 'api.twitch.tv/helix/streams')).toHaveLength(2)
    expect(s.calls.filter((c) => c === 'www.youtube.com/feeds/videos.xml')).toHaveLength(1) // the feed is cached for 5 minutes
  })

  it('refreshes an expired Twitch token once', async () => {
    let n = 0
    const s = await stream(TWITCH_ENV, {
      ...feed,
      ...token,
      'api.twitch.tv/helix/streams': () => (n++ === 0 ? new Response('', { status: 401 }) : new Response(JSON.stringify({ data: [] }))),
    })
    expect((await s.get()).live).toBeNull()
    expect(s.calls.filter((c) => c === 'id.twitch.tv/oauth2/token')).toHaveLength(2)
  })

  it('YouTube live with an API key; Twitch wins when both are live', async () => {
    const videos = ok({ items: [{ id: 'vid2', snippet: { title: 'Live now' }, liveStreamingDetails: { actualStartTime: '2026-09-23T18:00:00Z', concurrentViewers: '12' } }, { id: 'vid1', liveStreamingDetails: { actualStartTime: 'x', actualEndTime: 'y' } }] })
    const yt = await stream({ YOUTUBE_API_KEY: 'k' }, { ...feed, 'www.googleapis.com/youtube/v3/videos': videos })
    expect((await yt.get()).live).toEqual({ platform: 'youtube', title: 'Live now', viewers: 12, started_at: '2026-09-23T18:00:00Z', url: 'https://www.youtube.com/watch?v=vid2', embed: { kind: 'youtube', videoId: 'vid2' } })
    const both = await stream({ ...TWITCH_ENV, YOUTUBE_API_KEY: 'k' }, { ...feed, ...token, 'www.googleapis.com/youtube/v3/videos': videos, 'api.twitch.tv/helix/streams': ok({ data: [{ type: 'live', title: 'T', viewer_count: 1, started_at: null }] }) })
    expect((await both.get()).live.platform).toBe('twitch')
    captureConsole()
    const quota = await stream({ YOUTUBE_API_KEY: 'k' }, { ...feed, 'www.googleapis.com/youtube/v3/videos': () => new Response('{"error":{"code":403}}', { status: 403 }) })
    const q = await quota.get()
    expect(q.live).toBeNull()
    expect(q.recent).toHaveLength(4)
  })

  it('outages degrade to offline with no broadcasts, never an error', async () => {
    const out = captureConsole()
    const s = await stream(TWITCH_ENV, { 'id.twitch.tv/oauth2/token': () => new Response('', { status: 500 }) })
    const res = await s.get()
    expect(res.live).toBeNull()
    expect(res.recent).toEqual([])
    expect(out.streamWarnings()).toEqual([['[stream] YouTube feed failed (404)'], ['[stream] Twitch failed (500)']])
  })

  it('sends the YouTube key as a header, never in the URL', async () => {
    const seen: Array<{ url: URL; key: string | null }> = []
    const s = await stream({ YOUTUBE_API_KEY: 'yt-key' }, {
      ...feed,
      'www.googleapis.com/youtube/v3/videos': (url, init) => {
        seen.push({ url, key: new Headers(init?.headers).get('x-goog-api-key') })
        return new Response(JSON.stringify({ items: [] }))
      },
    })
    expect((await s.get()).live).toBeNull()
    expect(seen).toHaveLength(1)
    expect(seen[0].key).toBe('yt-key')
    expect(seen[0].url.search).not.toContain('yt-key')
  })

  it('logs an outage once when it starts and once when it ends, and never a secret', async () => {
    const out = captureConsole()
    let down = true
    const s = await stream({ ...TWITCH_ENV, TWITCH_CLIENT_SECRET: 'twitch-secret-123', YOUTUBE_API_KEY: 'yt-key-456' }, {
      ...feed,
      'id.twitch.tv/oauth2/token': () => (down ? new Response('{"message":"invalid client secret twitch-secret-123"}', { status: 500 }) : ok({ access_token: 't1' })()),
      'api.twitch.tv/helix/streams': ok({ data: [] }),
      'www.googleapis.com/youtube/v3/videos': () => (down ? new Response('{"error":{"message":"bad key yt-key-456"}}', { status: 403 }) : ok({ items: [] })()),
    })
    const first = await s.raw()
    const body = await first.text()
    const headers = JSON.stringify([...first.headers])
    for (const secret of ['twitch-secret-123', 'yt-key-456']) {
      expect(body).not.toContain(secret)
      expect(headers).not.toContain(secret)
    }
    expect(out.streamWarnings()).toEqual([['[stream] Twitch failed (500)'], ['[stream] YouTube live check failed (403)']])
    s.nowRef.now += 61_000
    await s.get() // still down: nothing new
    expect(out.streamWarnings()).toHaveLength(2)
    down = false
    s.nowRef.now += 61_000
    await s.get()
    expect(out.streamWarnings().slice(2)).toEqual([['[stream] Twitch recovered'], ['[stream] YouTube live check recovered']])
    const logged = out.text()
    for (const secret of ['twitch-secret-123', 'yt-key-456', 'https://']) expect(logged).not.toContain(secret)
  })

  it('a stale Twitch live result does not outlive an outage', async () => {
    captureConsole()
    let n = 0
    const s = await stream(TWITCH_ENV, {
      ...feed,
      ...token,
      'api.twitch.tv/helix/streams': () =>
        n++ === 0
          ? new Response(JSON.stringify({ data: [{ type: 'live', title: 'Ranked night', viewer_count: 42, started_at: '2026-09-23T18:00:00Z' }] }))
          : new Response('', { status: 500 }),
    })
    expect((await s.get()).live?.platform).toBe('twitch')
    s.nowRef.now += 61_000
    expect((await s.get()).live).toBeNull()
  })

  it('a stale YouTube live result does not outlive a quota error; recent stays populated', async () => {
    captureConsole()
    let n = 0
    const s = await stream({ YOUTUBE_API_KEY: 'k' }, {
      ...feed,
      'www.googleapis.com/youtube/v3/videos': () =>
        n++ === 0
          ? new Response(JSON.stringify({ items: [{ id: 'vid2', snippet: { title: 'Live now' }, liveStreamingDetails: { actualStartTime: '2026-09-23T18:00:00Z', concurrentViewers: '12' } }] }))
          : new Response('{"error":{"code":403}}', { status: 403 }),
    })
    expect((await s.get()).live?.platform).toBe('youtube')
    s.nowRef.now += 61_000
    const res = await s.get()
    expect(res.live).toBeNull()
    expect(res.recent).toHaveLength(4)
  })
})
