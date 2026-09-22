import { Hono } from 'hono'
import { type Env, modeOf } from './env'

export interface AppDeps {
  env: Env
}

export function createApp(deps: AppDeps) {
  const { env } = deps
  const app = env.basePath === '/' ? new Hono() : new Hono().basePath(env.basePath)

  app.notFound((c) =>
    c.req.path.includes('/api/')
      ? c.json({ error: 'not_found' }, 404)
      : c.text('Not found', 404),
  )

  app.get('/api/_status', (c) =>
    c.json({ mode: modeOf(env), app_version: env.appVersion, features: [...env.features] }),
  )

  return { app }
}
