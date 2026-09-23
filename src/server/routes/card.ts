import type { Hono } from 'hono'
import type { CardStat } from '../../shared/api-types'
import type { CardPageData } from '../../shared/hub-types'
import { cardSlug } from '../../shared/seo'
import type { CachedResult } from '../cache'
import { loadCardLeaders, loadCards } from './cards'
import { errorResponse, ok, type RouteDeps } from './common'

export type CardLookup =
  | { kind: 'found'; result: CachedResult<CardPageData> }
  | { kind: 'redirect'; slug: string }
  | { kind: 'missing' }

/**
 * Resolves a card by its slug. A display name or differently-cased slug resolves to a redirect to the canonical
 * slug; the ranked, casual and leader lists are optional extras that never fail the page.
 */
export async function loadCardPage(d: RouteDeps, requested: string): Promise<CardLookup> {
  const all = await loadCards(d, 'all')
  const list = all.value ?? []
  const want = cardSlug(requested)
  const index = list.findIndex((c) => cardSlug(c.card_name) === want)
  if (index < 0) return { kind: 'missing' }
  const card = list[index]
  const slug = cardSlug(card.card_name)
  if (requested !== slug) return { kind: 'redirect', slug }

  const [ranked, casual, leaders] = await Promise.allSettled([loadCards(d, 'ranked'), loadCards(d, 'casual'), loadCardLeaders(d)])
  const pick = (r: PromiseSettledResult<CachedResult<CardStat[]>>) =>
    r.status === 'fulfilled' ? (r.value.value.find((c) => c.card_name === card.card_name) ?? null) : null
  const lead = leaders.status === 'fulfilled' ? leaders.value.value : { winners: [], sweepers: [] }
  const mine = <T extends { card: string; count: number }>(rows: T[]) => rows.filter((r) => r.card === card.card_name).sort((a, b) => b.count - a.count)
  const neighbour = (c: CardStat | undefined) => (c ? { name: c.card_name, slug: cardSlug(c.card_name) } : null)
  const loads: Array<CachedResult<unknown>> = [all, ...[ranked, casual, leaders].flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))]

  return {
    kind: 'found',
    result: {
      value: {
        slug,
        card,
        ranked: pick(ranked),
        casual: pick(casual),
        winners: mine(lead.winners),
        sweepers: mine(lead.sweepers),
        prev: neighbour(list[index - 1]),
        next: neighbour(list[index + 1]),
      },
      fetched_at: Math.min(...loads.map((r) => r.fetched_at)),
      stale: loads.some((r) => r.stale),
    },
  }
}

export function registerCardPageRoute(app: Hono, d: RouteDeps) {
  app.get('/api/card/:slug', async (c) => {
    const slug = c.req.param('slug')
    if (slug.length > 64) return c.json({ error: 'bad_card' }, 400)
    try {
      let found = await loadCardPage(d, slug)
      if (found.kind === 'redirect') found = await loadCardPage(d, found.slug)
      if (found.kind !== 'found') return c.json({ error: 'not_found' }, 404)
      return ok(c, found.result)
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
