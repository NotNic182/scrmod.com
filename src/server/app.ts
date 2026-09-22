import { Hono } from 'hono'
import { Cache, MemoryCacheStore, type CacheStore } from './cache'
import { type Env } from './env'
import { registerAuthRoutes } from './routes/auth'
import { registerBoardRoutes } from './routes/boards'
import { registerCardRoutes } from './routes/cards'
import { registerChatRoutes } from './routes/chat'
import { registerHomeRoutes } from './routes/home'
import { registerMetaRoutes } from './routes/meta'
import { registerPlayerRoutes } from './routes/players'
import { registerStatusRoutes } from './routes/status'
import { registerTournamentRoutes } from './routes/tournaments'
import type { RouteDeps } from './routes/common'
import { Upstream } from './upstream'
import { ModVersionSource } from './version'

export interface AppDeps {
  env: Env
  fetchImpl?: typeof fetch
  store?: CacheStore
  now?: () => number
  /** fetch used for Discord's own API (Task 15); defaults to fetchImpl or global fetch. */
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

  registerStatusRoutes(app, routeDeps)
  registerMetaRoutes(app, routeDeps)
  registerHomeRoutes(app, routeDeps)
  registerBoardRoutes(app, routeDeps)
  registerPlayerRoutes(app, routeDeps)
  registerTournamentRoutes(app, routeDeps)
  registerCardRoutes(app, routeDeps)
  registerChatRoutes(app, routeDeps)
  registerAuthRoutes(app, { ...routeDeps, discordFetch: deps.discordFetch ?? deps.fetchImpl })

  return { app, cache, upstream, version, deps: routeDeps }
}
