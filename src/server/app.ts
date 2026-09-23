import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { Cache, MemoryCacheStore, type CacheStore } from './cache'
import { type Env } from './env'
import { registerAuthRoutes } from './routes/auth'
import { registerBoardRoutes } from './routes/boards'
import { registerCardPageRoute } from './routes/card'
import { registerCardRoutes } from './routes/cards'
import { registerChatRoutes } from './routes/chat'
import { registerHomeRoutes } from './routes/home'
import { registerMetaRoutes } from './routes/meta'
import { registerPlayerRoutes } from './routes/players'
import { registerStatusRoutes } from './routes/status'
import { registerTournamentRoutes } from './routes/tournaments'
import type { RouteDeps } from './routes/common'
import { canonicalHost } from './seo/host'
import { registerCrawlRoutes } from './seo/crawl'
import { rateLimit } from './ratelimit'
import { Upstream } from './upstream'
import { ModVersionSource } from './version'

export interface AppDeps {
  env: Env
  fetchImpl?: typeof fetch
  store?: CacheStore
  now?: () => number
  /** fetch used for Discord's own API; defaults to fetchImpl or global fetch. */
  discordFetch?: typeof fetch
}

export function createApp(deps: AppDeps) {
  const { env } = deps
  const now = deps.now ?? (() => Date.now())
  const version = new ModVersionSource({
    baseUrl: env.upstreamBase,
    userAgent: env.userAgent,
    override: env.modVersionOverride,
    fetchImpl: deps.fetchImpl,
    now,
  })
  const upstream = new Upstream({
    baseUrl: env.upstreamBase,
    userAgent: env.userAgent,
    internalKey: env.internalKey,
    version,
    fetchImpl: deps.fetchImpl,
    now,
  })
  const cache = new Cache(deps.store ?? new MemoryCacheStore(), now)
  const routeDeps: RouteDeps = { env, upstream, cache, version, now }

  const app = env.basePath === '/' ? new Hono() : new Hono().basePath(env.basePath)

  app.notFound((c) =>
    c.req.path.includes('/api/') ? c.json({ error: 'not_found' }, 404) : c.text('Not found', 404),
  )
  app.onError((err, c) => {
    console.error('[hub] unhandled', err)
    return c.json({ error: 'internal' }, 500)
  })

  app.use('*', canonicalHost(env))
  if (env.rateLimit) app.use('*', rateLimit({ now, prefix: env.basePath }))
  // JSON compresses ~5-10x and the live pages poll it every 15 s. Static files compress themselves (static.ts).
  app.use('/api/*', compress())

  registerStatusRoutes(app, routeDeps)
  registerMetaRoutes(app, routeDeps)
  registerHomeRoutes(app, routeDeps)
  registerBoardRoutes(app, routeDeps)
  registerPlayerRoutes(app, routeDeps)
  registerTournamentRoutes(app, routeDeps)
  registerCardRoutes(app, routeDeps)
  registerCardPageRoute(app, routeDeps)
  registerChatRoutes(app, routeDeps)
  registerAuthRoutes(app, { ...routeDeps, discordFetch: deps.discordFetch ?? deps.fetchImpl })
  registerCrawlRoutes(app, routeDeps)

  return { app, cache, upstream, version, deps: routeDeps }
}
