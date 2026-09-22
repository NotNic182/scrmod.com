import type { Hono } from 'hono'
import type { TournamentCurrent, TournamentHistoryDetail, TournamentHistoryRow } from '../../shared/api-types'
import { TTL } from '../cache'
import { errorResponse, gather, isUuid, loaderFor, ok, type RouteDeps } from './common'

export function registerTournamentRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/tournaments', async (c) => {
    const load = loaderFor(d, c)
    const g = await gather({
      sync: load<TournamentCurrent>('tourn:sync', TTL.BOARD, '/tournaments/current', { kind: 'sync' }),
      async: load<TournamentCurrent>('tourn:async', TTL.BOARD, '/tournaments/current', { kind: 'async' }),
    })
    c.header('Cache-Control', 'public, max-age=5')
    return c.json({
      data: { sync: g.values.sync ?? null, async: g.values.async ?? null },
      fetched_at: new Date(g.fetched_at).toISOString(),
      stale: g.stale,
      errors: g.errors,
    })
  })

  app.get('/api/tournaments/history', async (c) => {
    const load = loaderFor(d, c)
    const g = await gather({
      rows: load<TournamentHistoryRow[]>('tourn:history', TTL.BOARD, '/tournaments/history'),
      detail: load<TournamentHistoryDetail>('tourn:history-detail', TTL.BOARD, '/tournaments/history-detail', { limit: 8 }),
    })
    c.header('Cache-Control', 'public, max-age=5')
    return c.json({
      data: { rows: g.values.rows ?? [], detail: g.values.detail?.tournaments ?? [] },
      fetched_at: new Date(g.fetched_at).toISOString(),
      stale: g.stale,
      errors: g.errors,
    })
  })

  app.get('/api/tournaments/:id/bracket', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return c.json({ error: 'bad_tournament_id' }, 400)
    try {
      return ok(c, await loaderFor(d, c)(`tourn:bracket:${id.toLowerCase()}`, TTL.BOARD, `/tournaments/${id.toLowerCase()}/bracket-detail`))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
