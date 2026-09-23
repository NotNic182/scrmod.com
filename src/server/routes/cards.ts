import type { Hono } from 'hono'
import type { CardLeadersSummary, CardStat } from '../../shared/api-types'
import { TTL, type CachedResult } from '../cache'
import { errorResponse, loaderFor, ok, type RouteDeps } from './common'

const SORTS = new Set(['times_picked', 'win_rate', 'pass_rate', 'unique_players', 'matches_appeared', 'wins_with_card', 'times_offered'])
const FILTERS = new Set(['all', 'ranked', 'casual'])

export type CardFilter = 'all' | 'ranked' | 'casual'

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

/** The card stats list, under the same cache key the /api/cards route uses. */
export function loadCards(d: RouteDeps, filter: CardFilter = 'all', sort = 'times_picked', order: 'asc' | 'desc' = 'desc') {
  return loaderFor(d)<CardStat[]>(`cards:${filter}:${sort}:${order}`, TTL.REF, '/cards', {
    limit: 200,
    min_picks: 5,
    sort_by: sort,
    order,
    is_ranked: filter === 'ranked' ? 'true' : filter === 'casual' ? 'false' : undefined,
  })
}

/** Card leaders, parsed from the upstream's pipe-joined strings. */
export async function loadCardLeaders(d: RouteDeps): Promise<CachedResult<{ sweepers: CardLeader[]; winners: CardLeader[] }>> {
  const r = await loaderFor(d)<CardLeadersSummary>('cards:leaders', TTL.REF, '/cards/leaders-summary', { limit_per_card: 5 })
  return { ...r, value: { sweepers: parseLeaders(r.value.sweepers), winners: parseLeaders(r.value.winners) } }
}

export function registerCardRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/cards', async (c) => {
    const filter = c.req.query('filter') ?? 'all'
    const sort = c.req.query('sort') ?? 'times_picked'
    const order = c.req.query('order') === 'asc' ? 'asc' : 'desc'
    if (!FILTERS.has(filter)) return c.json({ error: 'bad_filter', filters: [...FILTERS] }, 400)
    if (!SORTS.has(sort)) return c.json({ error: 'bad_sort', sorts: [...SORTS] }, 400)
    try {
      return ok(c, await loadCards(d, filter as CardFilter, sort, order))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/cards/leaders', async (c) => {
    try {
      return ok(c, await loadCardLeaders(d))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/cards/:name/pickers', async (c) => {
    const name = c.req.param('name').trim()
    if (name.length < 1 || name.length > 64) return c.json({ error: 'bad_card_name' }, 400)
    try {
      // Keyed on the exact name, because that is what is forwarded upstream.
      return ok(c, await loaderFor(d)(`cards:pickers:${name}`, TTL.REF, '/cards/top-pickers', { card_name: name, limit: 10 }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
