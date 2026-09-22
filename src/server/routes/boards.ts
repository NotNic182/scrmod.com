import type { Hono } from 'hono'
import type { RecentSeriesList } from '../../shared/api-types'
import { maskRecentSeries } from '../../shared/privacy'
import { TTL } from '../cache'
import type { Query } from '../upstream'
import { errorResponse, intParam, loaderFor, ok, type RouteDeps } from './common'

const MODES: Record<string, { path: string; query: Query }> = {
  '1v1': { path: '/leaderboard', query: { limit: 500 } },
  '2v2': { path: '/team/leaderboard', query: { limit: 500 } },
  ffa: { path: '/ffa/leaderboard', query: { limit: 500 } },
  '1v2': { path: '/ovt/leaderboard', query: { limit: 500, role: 'combined' } },
  '1v2-solo': { path: '/ovt/leaderboard', query: { limit: 500, role: 'solo' } },
  '1v2-duo': { path: '/ovt/leaderboard', query: { limit: 500, role: 'duo' } },
}

export function registerBoardRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/leaderboard/:mode', async (c) => {
    const mode = c.req.param('mode')
    const spec = Object.hasOwn(MODES, mode) ? MODES[mode] : undefined
    if (!spec) return c.json({ error: 'unknown_mode', modes: Object.keys(MODES) }, 404)
    const inactive = c.req.query('inactive') === '1'
    try {
      const r = await loaderFor(d, c)(`lb:${mode}:${inactive ? 1 : 0}`, TTL.BOARD, spec.path, {
        ...spec.query,
        include_inactive: inactive ? true : undefined,
      })
      return ok(c, r)
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/results', async (c) => {
    const limit = intParam(c, 'limit', 60, 1, 200)
    try {
      return ok(c, await loaderFor(d, c)(`results:${limit}`, TTL.RESULTS, '/series/recent-multimode', { limit }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/results/1v1', async (c) => {
    const limit = intParam(c, 'limit', 50, 1, 200)
    try {
      const r = await loaderFor(d, c)<RecentSeriesList>(`results:1v1:${limit}`, TTL.RESULTS, '/series/recent', {
        minutes: 43200,
        limit,
      })
      const series = (r.value.series ?? []).map((s) => maskRecentSeries(s as unknown as Record<string, unknown>))
      return ok(c, { ...r, value: { series } })
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    if (q.length < 1 || q.length > 40) return c.json({ error: 'bad_query', detail: 'q must be 1-40 characters' }, 400)
    try {
      return ok(c, await loaderFor(d, c)(`search:${q.toLowerCase()}`, TTL.BOARD, '/players/search', { q, limit: 8 }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
