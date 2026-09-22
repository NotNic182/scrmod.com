import type { Context } from 'hono'
import { NotAllowedError } from '../allowlist'
import { type Background, type Cache, type CachedResult, type TtlSpec } from '../cache'
import type { Env } from '../env'
import { type Query, type Upstream, UpstreamError } from '../upstream'
import type { ModVersionSource } from '../version'

export interface RouteDeps {
  env: Env
  upstream: Upstream
  cache: Cache
  version: ModVersionSource
}

export function envelope<T>(r: CachedResult<T>) {
  return { data: r.value, fetched_at: new Date(r.fetched_at).toISOString(), stale: r.stale }
}

export function ok<T>(c: Context, r: CachedResult<T>, extra: Record<string, unknown> = {}) {
  c.header('Cache-Control', 'public, max-age=5')
  return c.json({ ...envelope(r), ...extra })
}

/** Maps upstream and network failures to hub status codes (spec 11). */
export function errorResponse(c: Context, err: unknown) {
  if (err instanceof UpstreamError) {
    if (err.status === 404 || err.status === 410) return c.json({ error: 'not_found', upstream_status: err.status }, 404)
    if (err.status === 426) {
      return c.json(
        { error: 'upstream_version_gate', detail: 'The site needs an update to talk to the new server version.' },
        503,
      )
    }
    if (err.status === 429) {
      c.header('Retry-After', '10')
      return c.json({ error: 'upstream_rate_limited', retry_after: 10 }, 503)
    }
    if (err.status === 400 || err.status === 422) return c.json({ error: 'bad_request', upstream_status: err.status }, 400)
    return c.json({ error: 'upstream_error', upstream_status: err.status }, 502)
  }
  if (err instanceof NotAllowedError) {
    console.error('[hub] route requested a non-allowlisted path', err.message)
    return c.json({ error: 'internal' }, 500)
  }
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return c.json({ error: 'upstream_timeout' }, 503)
  }
  if (err instanceof TypeError) return c.json({ error: 'upstream_unreachable' }, 503)
  console.error('[hub] unexpected error', err)
  return c.json({ error: 'internal' }, 500)
}

/** Serverless hosts expose an execution context that background work must attach to; on Node this is undefined. */
export function backgroundFor(c: Context): Background | undefined {
  try {
    const ctx = c.executionCtx
    return (p) => ctx.waitUntil(p.catch(() => {}))
  } catch {
    return undefined
  }
}

export function loaderFor(d: RouteDeps, c: Context) {
  const bg = backgroundFor(c)
  return <T>(key: string, spec: TtlSpec, path: string, query?: Query) =>
    d.cache.get<T>(key, spec, () => d.upstream.getJson<T>(path, query), bg)
}

export const STEAM_ID_RE = /^\d{17}$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isSteamId(s: string | undefined): s is string {
  return !!s && STEAM_ID_RE.test(s)
}

export function isUuid(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s)
}

export function intParam(c: Context, name: string, def: number, min: number, max: number): number {
  const raw = c.req.query(name)
  if (raw === undefined || raw === '') return def
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

/** Runs several cached loads in parallel; returns values, the oldest fetched_at, stale flag, and failed keys. */
export async function gather<T extends Record<string, Promise<CachedResult<unknown>>>>(jobs: T) {
  const keys = Object.keys(jobs) as Array<keyof T & string>
  const settled = await Promise.allSettled(Object.values(jobs))
  const values: Partial<{ [K in keyof T]: Awaited<T[K]>['value'] }> = {}
  const errors: string[] = []
  let stale = false
  let oldest = Date.now()
  settled.forEach((s, i) => {
    const k = keys[i]
    if (s.status === 'fulfilled') {
      values[k] = s.value.value as never
      stale ||= s.value.stale
      oldest = Math.min(oldest, s.value.fetched_at)
    } else {
      errors.push(k)
    }
  })
  return { values, errors, stale, fetched_at: oldest }
}
