import type { Hono } from 'hono'
import type { CardLeadersSummary } from '../../shared/api-types'
import { TTL } from '../cache'
import { errorResponse, loaderFor, ok, type RouteDeps } from './common'

const SORTS = new Set(['times_picked', 'win_rate', 'pass_rate', 'unique_players', 'matches_appeared', 'wins_with_card', 'times_offered'])
const FILTERS = new Set(['all', 'ranked', 'casual'])

export interface CardLeader {
  card: string
  player: string
  count: number
}

/** "Card Name|Player|count" -> CardLeader; malformed entries are dropped. */
export function parseLeaders(rows: string[] | undefined): CardLeader[] {
  const out: CardLeader[] = []
  for (const row of rows ?? []) {
    const parts = row.split('|')
    if (parts.length !== 3) continue
    const count = Number.parseInt(parts[2], 10)
    if (!Number.isFinite(count)) continue
    out.push({ card: parts[0], player: parts[1], count })
  }
  return out
}

export function registerCardRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/cards', async (c) => {
    const filter = c.req.query('filter') ?? 'all'
    const sort = c.req.query('sort') ?? 'times_picked'
    const order = c.req.query('order') === 'asc' ? 'asc' : 'desc'
    if (!FILTERS.has(filter)) return c.json({ error: 'bad_filter', filters: [...FILTERS] }, 400)
    if (!SORTS.has(sort)) return c.json({ error: 'bad_sort', sorts: [...SORTS] }, 400)
    try {
      return ok(
        c,
        await loaderFor(d, c)(`cards:${filter}:${sort}:${order}`, TTL.REF, '/cards', {
          limit: 200,
          min_picks: 5,
          sort_by: sort,
          order,
          is_ranked: filter === 'ranked' ? 'true' : filter === 'casual' ? 'false' : undefined,
        }),
      )
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/cards/leaders', async (c) => {
    try {
      const r = await loaderFor(d, c)<CardLeadersSummary>('cards:leaders', TTL.REF, '/cards/leaders-summary', { limit_per_card: 5 })
      return ok(c, { ...r, value: { sweepers: parseLeaders(r.value.sweepers), winners: parseLeaders(r.value.winners) } })
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/cards/:name/pickers', async (c) => {
    const name = c.req.param('name').trim()
    if (name.length < 1 || name.length > 64) return c.json({ error: 'bad_card_name' }, 400)
    try {
      return ok(c, await loaderFor(d, c)(`cards:pickers:${name.toLowerCase()}`, TTL.REF, '/cards/top-pickers', { card_name: name, limit: 10 }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
