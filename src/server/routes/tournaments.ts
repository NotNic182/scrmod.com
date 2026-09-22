import type { Hono } from 'hono'
import type { TournamentCurrent, TournamentHistoryDetail, TournamentHistoryRow } from '../../shared/api-types'
import { TTL } from '../cache'
import { errorResponse, gather, gathered, isUuid, loaderFor, ok, type RouteDeps } from './common'

export function registerTournamentRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/tournaments', async (c) => {
    const load = loaderFor(d)
    const g = await gather(
      {
        sync: load<TournamentCurrent>('tourn:sync', TTL.TOURNAMENT, '/tournaments/current', { kind: 'sync' }),
        async: load<TournamentCurrent>('tourn:async', TTL.TOURNAMENT, '/tournaments/current', { kind: 'async' }),
      },
      d.now,
    )
    return gathered(c, g, { sync: g.values.sync ?? null, async: g.values.async ?? null }, 5)
  })

  app.get('/api/tournaments/history', async (c) => {
    const load = loaderFor(d)
    const g = await gather(
      {
        rows: load<TournamentHistoryRow[]>('tourn:history', TTL.TOURNAMENT, '/tournaments/history'),
        detail: load<TournamentHistoryDetail>('tourn:history-detail', TTL.TOURNAMENT, '/tournaments/history-detail', {
          limit: 8,
        }),
      },
      d.now,
    )
    return gathered(c, g, { rows: g.values.rows ?? [], detail: g.values.detail?.tournaments ?? [] }, 5)
  })

  app.get('/api/tournaments/:id/bracket', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return c.json({ error: 'bad_tournament_id' }, 400)
    try {
      return ok(
        c,
        await loaderFor(d)(
          `tourn:bracket:${id.toLowerCase()}`,
          TTL.TOURNAMENT,
          `/tournaments/${id.toLowerCase()}/bracket-detail`,
        ),
      )
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
