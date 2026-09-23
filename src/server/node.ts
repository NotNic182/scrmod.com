import { serve } from '@hono/node-server'
import { createApp } from './app'
import { MemoryCacheStore } from './cache'
import { modeOf, parseEnv } from './env'
import { createFixtureFetch } from './fixtures'
import { registerStatic } from './static'

const env = parseEnv(process.env)
const fetchImpl = env.fixtures ? createFixtureFetch(env.fixturesDir) : undefined
const { app, version, deps } = createApp({ env, fetchImpl, store: new MemoryCacheStore() })
registerStatic(app, { root: env.webRoot, basePath: env.basePath, deps })

// Discover the mod version before the first visitor does, so nobody waits on it.
if (!env.fixtures) version.refresh().catch(() => {})

serve({ fetch: app.fetch, port: env.port }, (info) => {
  const base = env.basePath === '/' ? '' : env.basePath
  console.log(`[scrmod] ${modeOf(env)} mode listening on http://localhost:${info.port}${base}/  (upstream ${env.upstreamBase})`)
})
