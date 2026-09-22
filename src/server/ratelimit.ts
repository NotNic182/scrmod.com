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

/** Hard ceiling on tracked clients, in case a busy minute outruns the idle prune. */
const MAX_BUCKETS = 10_000

/** IPv4/IPv6 charset, longest form `::ffff:255.255.255.255` plus a zone id fits in 45. */
const IP_RE = /^[0-9a-fA-F:.]{1,45}$/

export interface RateLimitOptions {
  now?: () => number
  /** BASE_PATH, stripped before the request is classified. */
  prefix?: string
  api?: RateLimitRule
  auth?: RateLimitRule
  idleMs?: number
  maxBuckets?: number
}

/**
 * The client address as the proxy in front of the hub reports it: the LAST hop of
 * x-forwarded-for, because every edge appends its own view and only that last element is
 * written by something we trust — anything earlier is whatever the client sent. Falls back
 * to x-real-ip. A value that is not IP-shaped counts as absent, so a header cannot become
 * an arbitrary map key.
 */
export function clientIp(c: Context): string | null {
  const hops = c.req.header('x-forwarded-for')?.split(',')
  const last = hops?.[hops.length - 1]?.trim()
  if (last && IP_RE.test(last)) return last
  const real = c.req.header('x-real-ip')?.trim()
  if (real && IP_RE.test(real)) return real
  return null
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
  const maxBuckets = opts.maxBuckets ?? MAX_BUCKETS
  const buckets = new Map<string, Bucket>()
  let lastPrune = now()
  let warnedNoClientIp = false

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

    const ip = clientIp(c)
    if (!ip) {
      // Without a client address every visitor would share one bucket and throttle each
      // other, so fail open and say so once rather than limit the wrong thing.
      if (!warnedNoClientIp) {
        warnedNoClientIp = true
        console.warn(
          '[hub] rate limiting is OFF for these requests: no client address on them. The proxy in front ' +
            'of the hub must forward one — nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` ' +
            '(or `proxy_set_header X-Real-IP $remote_addr;`).',
        )
      }
      return next()
    }

    const rule = scope === 'api' ? api : auth
    const key = `${scope}:${ip}`
    const bucket = buckets.get(key) ?? { tokens: rule.limit, last: t }
    bucket.tokens = Math.min(rule.limit, bucket.tokens + ((t - bucket.last) * rule.limit) / rule.windowMs)
    bucket.last = t
    buckets.set(key, bucket)
    while (buckets.size > maxBuckets) {
      const oldest = buckets.keys().next().value
      if (oldest === undefined || oldest === key) break
      buckets.delete(oldest)
    }

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
