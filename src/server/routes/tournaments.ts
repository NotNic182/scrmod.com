import type { Hono } from 'hono'
import type { BracketDetail, TournamentCurrent, TournamentHistoryDetail, TournamentHistoryRow } from '../../shared/api-types'
import { TTL } from '../cache'
import { errorResponse, gather, gathered, isUuid, loaderFor, ok, type RouteDeps } from './common'

export async function loadTournaments(d: RouteDeps) {
  const load = loaderFor(d)
  const g = await gather(
    {
      sync: load<TournamentCurrent>('tourn:sync', TTL.TOURNAMENT, '/tournaments/current', { kind: 'sync' }),
      async: load<TournamentCurrent>('tourn:async', TTL.TOURNAMENT, '/tournaments/current', { kind: 'async' }),
    },
    d.now,
  )
  return { data: { sync: g.values.sync ?? null, async: g.values.async ?? null }, g }
}

export async function loadTournamentHistory(d: RouteDeps) {
  const load = loaderFor(d)
  const g = await gather(
    {
      rows: load<TournamentHistoryRow[]>('tourn:history', TTL.TOURNAMENT, '/tournaments/history'),
      detail: load<TournamentHistoryDetail>('tourn:history-detail', TTL.TOURNAMENT, '/tournaments/history-detail', { limit: 8 }),
    },
    d.now,
  )
  return { data: { rows: g.values.rows ?? [], detail: g.values.detail?.tournaments ?? [] }, g }
}

export function loadBracket(d: RouteDeps, id: string) {
  const key = id.toLowerCase()
  return loaderFor(d)<BracketDetail>(`tourn:bracket:${key}`, TTL.TOURNAMENT, `/tournaments/${key}/bracket-detail`)
}

export function registerTournamentRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/tournaments', async (c) => {
    const { data, g } = await loadTournaments(d)
    return gathered(c, g, data, 5)
  })

  app.get('/api/tournaments/history', async (c) => {
    const { data, g } = await loadTournamentHistory(d)
    return gathered(c, g, data, 5)
  })

  app.get('/api/tournaments/:id/bracket', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return c.json({ error: 'bad_tournament_id' }, 400)
    try {
      return ok(c, await loadBracket(d, id))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
