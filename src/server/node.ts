import { serve } from '@hono/node-server'
import { createApp } from './app'
import { MemoryCacheStore } from './cache'
import { modeOf, parseEnv } from './env'
import { createFixtureFetch } from './fixtures'
import { registerStatic } from './static'

const env = parseEnv(process.env)
const fetchImpl = env.fixtures ? createFixtureFetch(env.fixturesDir) : undefined
const { app } = createApp({ env, fetchImpl, store: new MemoryCacheStore() })
registerStatic(app, { root: process.env.SCR_WEB_ROOT || 'dist/web', basePath: env.basePath })

const port = Number(process.env.PORT || 8080)
serve({ fetch: app.fetch, port }, (info) => {
  const base = env.basePath === '/' ? '' : env.basePath
  console.log(`[scr-hub] ${modeOf(env)} mode listening on http://localhost:${info.port}${base}/  (upstream ${env.upstreamBase})`)
})
