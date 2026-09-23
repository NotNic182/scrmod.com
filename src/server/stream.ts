import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Hono } from 'hono'
import type { StreamData, StreamLive, StreamVideo } from '../shared/hub-types'
import { LINKS } from '../shared/links'
import type { RouteDeps } from './routes/common'

const TIMEOUT_MS = 5000
const FEED_TTL = { ttlMs: 300_000, staleMs: 3_600_000 }
const LIVE_TTL = { ttlMs: 60_000, staleMs: 0 }

/** An upstream's error status. It carries no URL, header or key, so it is safe to log. */
class StatusError extends Error {
  constructor(
    what: string,
    readonly status: number,
  ) {
    super(`${what} ${status}`)
    this.name = 'StatusError'
  }
}

/** Why a load failed, short and secret-free: the status an upstream answered with, else the error's name. */
function reason(err: unknown): string {
  if (err instanceof StatusError) return String(err.status)
  return err instanceof Error ? err.name : 'unknown'
}

/**
 * Runs each source's loads and logs when the source starts failing and when it recovers, not on every request:
 * a Twitch or YouTube outage is one line, however many visitors see it.
 */
function outageLog() {
  const failing = new Set<string>()
  return async <T>(source: string, load: () => Promise<T>): Promise<T> => {
    try {
      const value = await load()
      if (failing.delete(source)) console.warn(`[stream] ${source} recovered`)
      return value
    } catch (err) {
      if (!failing.has(source)) {
        failing.add(source)
        console.warn(`[stream] ${source} failed (${reason(err)})`)
      }
      throw err
    }
  }
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** The channel's public uploads feed, newest first. */
export function parseYouTubeFeed(xml: string): StreamVideo[] {
  const out: StreamVideo[] = []
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1]
    const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(e)?.[1]
    const title = /<title>([^<]*)<\/title>/.exec(e)?.[1]
    const published = /<published>([^<]+)<\/published>/.exec(e)?.[1]
    if (!videoId || title === undefined) continue
    out.push({ videoId, title: decodeXml(title), url: `https://www.youtube.com/watch?v=${videoId}`, published_at: published ?? '' })
  }
  return out
}

/** Twitch Helix with an app access token (client credentials), refreshed once on a 401. */
export class TwitchClient {
  private token: string | null = null

  constructor(private readonly opts: { clientId: string; clientSecret: string; fetchImpl: typeof fetch }) {}

  private async fetchToken(): Promise<string> {
    const body = new URLSearchParams({ client_id: this.opts.clientId, client_secret: this.opts.clientSecret, grant_type: 'client_credentials' })
    const res = await this.opts.fetchImpl('https://id.twitch.tv/oauth2/token', { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new StatusError('twitch token', res.status)
    const json = (await res.json()) as { access_token?: string }
    if (!json.access_token) throw new Error('twitch token missing')
    this.token = json.access_token
    return this.token
  }

  private async helix(pathAndQuery: string): Promise<Response> {
    const call = async (token: string) =>
      this.opts.fetchImpl(`https://api.twitch.tv/helix${pathAndQuery}`, {
        headers: { 'Client-Id': this.opts.clientId, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    let res = await call(this.token ?? (await this.fetchToken()))
    if (res.status === 401) res = await call(await this.fetchToken())
    if (!res.ok) throw new StatusError('twitch', res.status)
    return res
  }

  async live(login: string): Promise<StreamLive | null> {
    const res = await this.helix(`/streams?user_login=${encodeURIComponent(login)}`)
    const s = ((await res.json()) as { data?: Array<{ type?: string; title?: string; viewer_count?: number; started_at?: string }> }).data?.[0]
    if (!s || s.type !== 'live') return null
    return { platform: 'twitch', title: s.title ?? '', viewers: s.viewer_count ?? null, started_at: s.started_at ?? null, url: `https://www.twitch.tv/${login}`, embed: { kind: 'twitch', channel: login } }
  }
}

async function youtubeLive(ids: string[], apiKey: string, fetchImpl: typeof fetch): Promise<StreamLive | null> {
  if (!ids.length) return null
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${ids.map(encodeURIComponent).join(',')}`
  // The key goes in a header, not the query string, so it stays out of any log that records URLs.
  const res = await fetchImpl(url, { headers: { 'X-Goog-Api-Key': apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new StatusError('youtube', res.status)
  const items = ((await res.json()) as { items?: Array<{ id: string; snippet?: { title?: string }; liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string; concurrentViewers?: string } }> }).items ?? []
  const v = items.find((i) => i.liveStreamingDetails?.actualStartTime && !i.liveStreamingDetails.actualEndTime)
  if (!v) return null
  const viewers = Number(v.liveStreamingDetails?.concurrentViewers)
  return {
    platform: 'youtube',
    title: v.snippet?.title ?? '',
    viewers: Number.isFinite(viewers) ? viewers : null,
    started_at: v.liveStreamingDetails?.actualStartTime ?? null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    embed: { kind: 'youtube', videoId: v.id },
  }
}

/** GET /api/stream: is the community live on Twitch or YouTube, and what did it broadcast lately. Never fails. */
export function registerStreamRoutes(app: Hono, d: RouteDeps, fetchImpl: typeof fetch) {
  const s = d.env.stream
  const twitch = s.twitchClientId && s.twitchClientSecret ? new TwitchClient({ clientId: s.twitchClientId, clientSecret: s.twitchClientSecret, fetchImpl }) : null
  const links = { twitch: LINKS.twitch, youtube: LINKS.youtube }
  const watch = outageLog()

  app.get('/api/stream', async (c) => {
    c.header('Cache-Control', 'public, max-age=30')
    if (d.env.fixtures) {
      let data: StreamData = { live: null, recent: [], links }
      try {
        data = JSON.parse(await readFile(path.join(d.env.fixturesDir, 'stream.json'), 'utf8')) as StreamData
      } catch {
        // no fixture: offline
      }
      return c.json({ data, fetched_at: new Date(d.now()).toISOString(), stale: false })
    }

    const [feedR, twitchR] = await Promise.allSettled([
      d.cache.get('stream:yt-feed', FEED_TTL, () =>
        watch('YouTube feed', async () => {
          const res = await fetchImpl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(s.youtubeChannelId)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
          if (!res.ok) throw new StatusError('feed', res.status)
          return parseYouTubeFeed(await res.text())
        }),
      ),
      twitch ? d.cache.get('stream:twitch', LIVE_TTL, () => watch('Twitch', () => twitch.live(s.twitchLogin))) : Promise.resolve(null),
    ])
    const recent = feedR.status === 'fulfilled' ? feedR.value.value : []
    // LIVE_TTL has no stale window, so `stale: true` here only means the cache's error
    // fallback fired (spec 6.3): the live check itself failed and this is an old answer.
    // A stream that failed to confirm as live must report offline, not repeat a broadcast
    // that may already be over.
    let live: StreamLive | null = twitchR.status === 'fulfilled' && twitchR.value && !twitchR.value.stale ? twitchR.value.value : null
    if (!live && s.youtubeApiKey && recent.length) {
      try {
        const key = s.youtubeApiKey
        const r = await d.cache.get('stream:yt-live', LIVE_TTL, () => watch('YouTube live check', () => youtubeLive(recent.slice(0, 5).map((v) => v.videoId), key, fetchImpl)))
        live = r.stale ? null : r.value
      } catch {
        live = null
      }
    }
    const data: StreamData = { live, recent: recent.slice(0, 4), links }
    return c.json({ data, fetched_at: new Date(d.now()).toISOString(), stale: false })
  })
}
