import type { Hono } from 'hono'
import type { FfaLeaderboard, Leaderboard, MultimodeRecent, OvtLeaderboard, RecentSeriesList, TeamLeaderboard } from '../../shared/api-types'
import { maskRecentSeries } from '../../shared/privacy'
import { TTL, type CachedResult } from '../cache'
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

export type BoardData = Leaderboard | TeamLeaderboard | FfaLeaderboard | OvtLeaderboard

/** A leaderboard, under the same cache key the /api/leaderboard route uses; null for an unknown mode. */
export async function loadBoard(d: RouteDeps, mode: string, inactive = false): Promise<CachedResult<BoardData> | null> {
  const spec = Object.hasOwn(MODES, mode) ? MODES[mode] : undefined
  if (!spec) return null
  return loaderFor(d)<BoardData>(`lb:${mode}:${inactive ? 1 : 0}`, TTL.BOARD, spec.path, {
    ...spec.query,
    include_inactive: inactive ? true : undefined,
  })
}

export function loadResults(d: RouteDeps, limit: number) {
  return loaderFor(d)<MultimodeRecent>(`results:${limit}`, TTL.RESULTS, '/series/recent-multimode', { limit })
}

export function registerBoardRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/leaderboard/:mode', async (c) => {
    const mode = c.req.param('mode')
    if (!Object.hasOwn(MODES, mode)) return c.json({ error: 'unknown_mode', modes: Object.keys(MODES) }, 404)
    try {
      return ok(c, (await loadBoard(d, mode, c.req.query('inactive') === '1'))!)
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/results', async (c) => {
    const limit = intParam(c, 'limit', 60, 1, 200)
    try {
      return ok(c, await loadResults(d, limit))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/results/1v1', async (c) => {
    const limit = intParam(c, 'limit', 50, 1, 200)
    try {
      const r = await loaderFor(d)<RecentSeriesList>(`results:1v1:${limit}`, TTL.RESULTS, '/series/recent', {
        minutes: 43200,
        limit,
      })
      const series = (r.value.series ?? []).map((s) => maskRecentSeries(s))
      return ok(c, { ...r, value: { series } })
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    if (q.length < 1 || q.length > 40) return c.json({ error: 'bad_query', detail: 'q must be 1-40 characters' }, 400)
    try {
      return ok(c, await loaderFor(d)(`search:${q.toLowerCase()}`, TTL.BOARD, '/players/search', { q, limit: 8 }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
