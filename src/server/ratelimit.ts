import type { Context, MiddlewareHandler } from 'hono'

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number
  windowMs: number
}

/**
 * Sid's API allows 150 req/10 s per IP and the hub is a single IP to it, so the hub has to
 * meter its own visitors: search terms, viewer pairs, card names and match pages are all
 * cold cache keys one person can enumerate, and every /auth/* hit is a Discord token POST.
 */
export const API_RULE: RateLimitRule = { limit: 60, windowMs: 10_000 }
export const AUTH_RULE: RateLimitRule = { limit: 10, windowMs: 60_000 }

/** Buckets idle for longer than this are dropped, so the map cannot grow forever. */
const IDLE_MS = 600_000

export interface RateLimitOptions {
  now?: () => number
  /** BASE_PATH, stripped before the request is classified. */
  prefix?: string
  api?: RateLimitRule
  auth?: RateLimitRule
  idleMs?: number
}

/** First hop of x-forwarded-for, then x-real-ip, then a single shared local bucket. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const real = c.req.header('x-real-ip')?.trim()
  if (real) return real
  return 'local'
}

interface Bucket {
  tokens: number
  last: number
}

export type RateLimitMiddleware = MiddlewareHandler & { buckets: () => number }

/** A token bucket per client IP and scope. The clock is injectable so tests need no timers. */
export function rateLimit(opts: RateLimitOptions = {}): RateLimitMiddleware {
  const now = opts.now ?? (() => Date.now())
  const prefix = opts.prefix && opts.prefix !== '/' ? opts.prefix : ''
  const api = opts.api ?? API_RULE
  const auth = opts.auth ?? AUTH_RULE
  const idleMs = opts.idleMs ?? IDLE_MS
  const buckets = new Map<string, Bucket>()
  let lastPrune = now()

  const middleware: MiddlewareHandler = async (c, next) => {
    const t = now()
    if (t - lastPrune >= idleMs) {
      for (const [k, b] of buckets) if (t - b.last >= idleMs) buckets.delete(k)
      lastPrune = t
    }

    let path = c.req.path
    if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length) || '/'
    // _status is the deploy health check: it must answer even while a client is throttled.
    const scope =
      path === '/api/_status' ? null : path.startsWith('/api/') ? 'api' : path.startsWith('/auth/') ? 'auth' : null
    if (!scope) return next()

    const rule = scope === 'api' ? api : auth
    const key = `${scope}:${clientIp(c)}`
    const bucket = buckets.get(key) ?? { tokens: rule.limit, last: t }
    bucket.tokens = Math.min(rule.limit, bucket.tokens + ((t - bucket.last) * rule.limit) / rule.windowMs)
    bucket.last = t
    buckets.set(key, bucket)

    if (bucket.tokens < 1) {
      const retryAfter = Math.max(1, Math.ceil(((1 - bucket.tokens) * rule.windowMs) / rule.limit / 1000))
      c.header('Retry-After', String(retryAfter))
      return c.json({ error: 'rate_limited', retry_after: retryAfter }, 429)
    }
    bucket.tokens -= 1
    return next()
  }

  return Object.assign(middleware, { buckets: () => buckets.size })
}
