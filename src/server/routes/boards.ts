import type { Hono } from 'hono'
import type {
  FfaLeaderboard,
  Leaderboard,
  MultimodeEntry,
  MultimodeRecent,
  OvtLeaderboard,
  RecentSeries,
  RecentSeriesList,
  TeamLeaderboard,
} from '../../shared/api-types'
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

/** Recent 1v1 series, under the same cache key the /api/results/1v1 route uses. */
export function loadRecentSeries(d: RouteDeps, limit: number) {
  return loaderFor(d)<RecentSeriesList>(`results:1v1:${limit}`, TTL.RESULTS, '/series/recent', { minutes: 43200, limit })
}

/** A 1v1 series as a row of the mixed results feed: the winner on the left and the series score between. */
function seriesEntry(s: RecentSeries): MultimodeEntry {
  const p1Won = s.winner_steam_id === s.p1_steam_id
  return {
    mode: '1v1',
    id: s.series_id,
    ended_at: s.completed_at,
    left_label: p1Won ? s.p1_name : s.p2_name,
    right_label: p1Won ? s.p2_name : s.p1_name,
    score: p1Won ? `${s.p1_series_wins}-${s.p2_series_wins}` : `${s.p2_series_wins}-${s.p1_series_wins}`,
    left_rating_change: (p1Won ? s.p1_rating_change : s.p2_rating_change) ?? null,
    right_rating_change: (p1Won ? s.p2_rating_change : s.p1_rating_change) ?? null,
    settings: null,
    bets: s.bets ?? [],
  }
}

/**
 * The mixed results feed. Sid's multimode feed carries 2v2, FFA and 1v2 games only, so 1v1 series are merged in
 * from /series/recent, newest first. If one source fails the other is still served, marked stale; if both fail,
 * the first error is thrown.
 */
export async function loadResults(d: RouteDeps, limit: number): Promise<CachedResult<MultimodeRecent>> {
  const [multi, series] = await Promise.allSettled([
    loaderFor(d)<MultimodeRecent>(`results:${limit}`, TTL.RESULTS, '/series/recent-multimode', { limit }),
    loadRecentSeries(d, limit),
  ])
  if (multi.status === 'rejected' && series.status === 'rejected') throw multi.reason
  const entries = [
    ...(multi.status === 'fulfilled' ? (multi.value.value?.entries ?? []) : []),
    ...(series.status === 'fulfilled' ? (series.value.value?.series ?? []).map(seriesEntry) : []),
  ]
    .sort((a, b) => Date.parse(b.ended_at) - Date.parse(a.ended_at))
    .slice(0, limit)
  const loaded = [multi, series].flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  return {
    value: { entries },
    fetched_at: Math.min(...loaded.map((r) => r.fetched_at)),
    stale: loaded.length < 2 || loaded.some((r) => r.stale),
  }
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
      const r = await loadRecentSeries(d, limit)
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
