import type { Hono } from 'hono'
import type { StatusResponse } from '../../shared/hub-types'
import { modeOf } from '../env'
import type { RouteDeps } from './common'

export function registerStatusRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/_status', async (c) => {
    const body: StatusResponse = {
      mode: modeOf(d.env),
      app_version: d.env.appVersion,
      features: [...d.env.features],
      auth_enabled: !!d.env.discord,
      upstream: { base: d.env.upstreamBase, version: d.version.state() },
      cache: { size: d.cache.size() },
    }
    if (c.req.query('probe') === '1') {
      try {
        await d.upstream.getJson('/health')
        body.upstream.reachable = true
      } catch {
        body.upstream.reachable = false
      }
    }
    c.header('Cache-Control', 'no-store')
    return c.json(body)
  })
}
