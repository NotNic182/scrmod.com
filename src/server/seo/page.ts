import type { Context } from 'hono'
import { scrubPrivate } from '../../shared/privacy'
import { GUIDE_CHECKED, GUIDE_TITLE } from '../../shared/guide'
import { cardSlug, matchRoute, pageMeta, slugToName, type MetaFacts, type PlayerFacts } from '../../shared/seo'
import { loadBoard, loadResults } from '../routes/boards'
import { loadCardPage } from '../routes/card'
import { loadCards } from '../routes/cards'
import type { RouteDeps } from '../routes/common'
import { loadHome } from '../routes/home'
import { loadProfile } from '../routes/players'
import { loadBracket, loadTournamentHistory, loadTournaments } from '../routes/tournaments'
import { UpstreamError } from '../upstream'
import { renderHead } from './head'
import { article, breadcrumbs, itemList, siteGraph } from './jsonld'
import { renderShell, type ShellData } from './shell'
import { basePrefix, siteUrl } from './site'

/** How long a page waits for its data before rendering generic text instead. */
export const SHELL_DATA_MS = 250

type Settled<T> = { ok: true; value: T } | { ok: false; notFound: boolean }

/** What a page gets instead of its data when its client is over the API budget (ratelimit.ts). */
const SKIPPED = { ok: false, notFound: false } as const

/** Waits up to SHELL_DATA_MS; an upstream 404/410 is reported as notFound, anything else (timeout, error) is not. */
async function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Settled<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, notFound: false }), SHELL_DATA_MS)
  })
  const work = p.then(
    (value): Settled<T> => ({ ok: true, value }),
    (err): Settled<T> => ({ ok: false, notFound: err instanceof UpstreamError && (err.status === 404 || err.status === 410) }),
  )
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** The few profile fields a page's description and shell use, each dropped when it isn't the expected type. */
function playerFacts(p: Record<string, unknown>): PlayerFacts {
  return {
    display_name: String(p.display_name ?? ''),
    rating: typeof p.rating === 'number' ? p.rating : null,
    rank_name: typeof p.rank_name === 'string' ? p.rank_name : null,
    standing: typeof p.standing === 'number' ? p.standing : null,
    standing_population: typeof p.standing_population === 'number' ? p.standing_population : null,
    ranked_series_wins: typeof p.ranked_series_wins === 'number' ? p.ranked_series_wins : null,
    ranked_series_losses: typeof p.ranked_series_losses === 'number' ? p.ranked_series_losses : null,
  }
}

export type PageResult = { redirect: string } | { status: 200 | 404; head: string; body: string; index: boolean }

export async function resolvePage(d: RouteDeps, path: string, c: Context): Promise<PageResult> {
  const base = basePrefix(d.env)
  const site = siteUrl(d.env, c)
  // Player and tournament ids come from the address, so a client over its API budget gets those pages without data.
  const overBudget = c.get('overBudget') === true
  let match = matchRoute(path)
  if (match.kind === 'leaderboards-root') return { redirect: `${base}/leaderboards/1v1` }

  let shell: ShellData = { kind: 'not-found' }
  const facts: MetaFacts = {}
  const jsonLd: object[] = [siteGraph(site)]

  switch (match.kind) {
    case 'home': {
      // Shaping happens inside the settled promise, so a malformed upstream value (or a bad field
      // access on it) is just another failed load, not a throw that reaches the caller.
      const r = await settle(loadHome(d).then((h) => scrubPrivate(h.data)))
      shell = { kind: 'home', home: r.ok ? r.value : undefined }
      break
    }
    case 'leaderboard': {
      const r = await settle(loadBoard(d, match.mode).then((b) => (b ? scrubPrivate(b.value) : undefined)))
      shell = { kind: 'leaderboard', mode: match.mode, board: r.ok ? r.value : undefined }
      break
    }
    case 'results': {
      const r = await settle(loadResults(d, 100).then((res) => scrubPrivate(res.value.entries ?? [])))
      shell = { kind: 'results', results: r.ok ? r.value : undefined }
      break
    }
    case 'tournaments': {
      const r = await settle(
        Promise.all([loadTournaments(d), loadTournamentHistory(d)]).then(([t, h]) => ({
          current: scrubPrivate(t.data),
          history: scrubPrivate(h.data.rows),
        })),
      )
      shell = r.ok ? { kind: 'tournaments', current: r.value.current, history: r.value.history } : { kind: 'tournaments' }
      break
    }
    case 'tournament': {
      const r = overBudget ? SKIPPED : await settle(loadBracket(d, match.id))
      if (!r.ok && r.notFound) match = { kind: 'not-found' }
      else shell = { kind: 'tournament', id: match.id }
      break
    }
    case 'cards': {
      // cardSlug() can throw on a malformed row (no card_name); build the itemList and count
      // inside the settled promise too, so that also becomes an ordinary failed load.
      const r = await settle(
        loadCards(d, 'all').then((res) => {
          const cards = scrubPrivate(res.value)
          return { cards, listing: itemList(site, cards.map((c) => ({ name: c.card_name, path: `/cards/${cardSlug(c.card_name)}` }))) }
        }),
      )
      shell = { kind: 'cards', cards: r.ok ? r.value.cards : undefined }
      if (r.ok) {
        facts.cardCount = r.value.cards.length
        jsonLd.push(r.value.listing)
      }
      break
    }
    case 'card': {
      const r = await settle(loadCardPage(d, match.slug))
      if (r.ok && r.value.kind === 'redirect') return { redirect: `${base}/cards/${r.value.slug}` }
      if (r.ok && r.value.kind === 'missing') {
        match = { kind: 'not-found' }
        break
      }
      const page = r.ok && r.value.kind === 'found' ? scrubPrivate(r.value.result.value) : undefined
      shell = { kind: 'card', slug: match.slug, page }
      if (page) facts.card = { name: page.card.card_name, rarity: page.card.card_rarity, win_rate: page.card.win_rate, times_picked: page.card.times_picked, pass_rate: page.card.pass_rate }
      const name = page?.card.card_name ?? slugToName(match.slug)
      jsonLd.push(breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Cards', path: '/cards' }, { name, path: `/cards/${cardSlug(name)}` }]))
      break
    }
    case 'guide': {
      shell = { kind: 'guide' }
      const meta = pageMeta(match)
      jsonLd.push(article(site, { headline: GUIDE_TITLE, description: meta.description, path: '/guide', dateModified: GUIDE_CHECKED }))
      jsonLd.push(breadcrumbs(site, [{ name: 'Home', path: '/' }, { name: 'Guide', path: '/guide' }]))
      break
    }
    case 'about':
      shell = { kind: 'about' }
      break
    case 'player': {
      const r = overBudget ? SKIPPED : await settle(loadProfile(d, match.id).then((res) => playerFacts(res.value)))
      if (!r.ok && r.notFound) {
        match = { kind: 'not-found' }
        break
      }
      const player = r.ok ? r.value : undefined
      facts.player = player
      shell = { kind: 'player', id: match.id, player }
      break
    }
  }

  if (match.kind === 'not-found') shell = { kind: 'not-found' }
  const meta = pageMeta(match, facts)
  const head = renderHead({ meta, site, jsonLd: match.kind === 'not-found' ? [] : jsonLd, verification: { google: d.env.googleVerification, bing: d.env.bingVerification } })
  return { status: match.kind === 'not-found' ? 404 : 200, head, body: renderShell(shell, base), index: meta.index }
}
