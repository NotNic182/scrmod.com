/**
 * Page metadata for every route, shared by the server (head tags and the crawlable shell) and the web app
 * (document titles), so the raw HTML and the page after JavaScript always agree. No DOM or Node APIs here.
 */

export const SITE_NAME = 'SCRmod'

export const BOARD_MODES: ReadonlyArray<{ id: string; label: string; ranked: boolean }> = [
  { id: '1v1', label: '1v1', ranked: true },
  { id: '2v2', label: '2v2', ranked: true },
  { id: 'ffa', label: 'FFA', ranked: true },
  { id: '1v2', label: '1v2', ranked: false },
  { id: '1v2-solo', label: '1v2 solo', ranked: false },
  { id: '1v2-duo', label: '1v2 duo', ranked: false },
]

/** The one-line intros under page headings. */
export const INTROS = {
  leaderboards: "Ranked ROUNDS players in Sid's Competitive Rounds, ordered by rating.",
  leaderboards1v2: 'One player against a duo: the unranked 1v2 beta mode.',
  results: 'The latest finished ranked and casual games, newest first.',
  tournaments: 'Weekly and async ROUNDS tournaments: signups, brackets and past winners.',
  cards: 'Win, pick and pass rates for every ROUNDS card across ranked and casual games.',
  watch: "Ranked ROUNDS games and tournaments from Sid's Competitive Rounds, streamed on Twitch and YouTube.",
} as const

/** "Big Bullet" → "big-bullet": lowercase, accents stripped, runs of anything else become one dash. */
export function cardSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A readable stand-in name when only the slug is known ("big-bullet" → "Big Bullet"). */
export function slugToName(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export type RouteMatch =
  | { kind: 'home' }
  | { kind: 'leaderboards-root' }
  | { kind: 'leaderboard'; mode: string }
  | { kind: 'results' }
  | { kind: 'tournaments' }
  | { kind: 'tournament'; id: string }
  | { kind: 'cards' }
  | { kind: 'card'; slug: string }
  | { kind: 'guide' }
  | { kind: 'about' }
  | { kind: 'watch' }
  | { kind: 'player'; id: string }
  | { kind: 'not-found' }

const STEAM_ID = /^\d{17}$/
/** A tournament id as the server's routes accept it. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND: RouteMatch = { kind: 'not-found' }

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/** Maps a path (without the base path) to the page it names. */
export function matchRoute(path: string): RouteMatch {
  const parts = path.split('/').filter(Boolean).map(decode)
  if (parts.some((p) => p === null)) return NOT_FOUND
  const [a, b, ...rest] = parts as string[]
  if (!a) return { kind: 'home' }
  if (rest.length) return NOT_FOUND
  switch (a) {
    case 'leaderboards':
      if (!b) return { kind: 'leaderboards-root' }
      return BOARD_MODES.some((m) => m.id === b) ? { kind: 'leaderboard', mode: b } : NOT_FOUND
    case 'results':
      return b ? NOT_FOUND : { kind: 'results' }
    case 'tournaments':
      if (!b) return { kind: 'tournaments' }
      return UUID.test(b) ? { kind: 'tournament', id: b.toLowerCase() } : NOT_FOUND
    case 'cards':
      if (!b) return { kind: 'cards' }
      return b.length <= 64 ? { kind: 'card', slug: b } : NOT_FOUND
    case 'guide':
      return b ? NOT_FOUND : { kind: 'guide' }
    case 'about':
      return b ? NOT_FOUND : { kind: 'about' }
    case 'watch':
      return b ? NOT_FOUND : { kind: 'watch' }
    case 'players':
      return b && STEAM_ID.test(b) ? { kind: 'player', id: b } : NOT_FOUND
    default:
      return NOT_FOUND
  }
}

export interface PageMeta {
  title: string
  description: string
  /** Canonical path, or null for a page that has none (not found). */
  path: string | null
  index: boolean
  ogType: 'website' | 'article' | 'profile'
}

export interface CardFacts {
  name: string
  rarity: string
  win_rate: number
  times_picked: number
  pass_rate: number
}

export interface PlayerFacts {
  display_name: string
  rating?: number | null
  rank_name?: string | null
  standing?: number | null
  standing_population?: number | null
  ranked_series_wins?: number | null
  ranked_series_losses?: number | null
}

export interface MetaFacts {
  card?: CardFacts
  player?: PlayerFacts
  cardCount?: number
}

const titled = (t: string) => `${t} · ${SITE_NAME}`
const percent = (f: number) => `${Math.round(f * 100)}%`
const count = (n: number) => n.toLocaleString('en-US')

function playerLine(p: PlayerFacts | undefined): string | null {
  if (!p) return null
  const parts = [
    p.rating != null ? `${Math.round(p.rating)} rating` : null,
    p.rank_name || null,
    p.standing ? `#${p.standing}${p.standing_population ? ` of ${p.standing_population}` : ''}` : null,
    p.ranked_series_wins != null && p.ranked_series_losses != null ? `${p.ranked_series_wins}-${p.ranked_series_losses} ranked series` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function pageMeta(m: RouteMatch, facts: MetaFacts = {}): PageMeta {
  switch (m.kind) {
    case 'home':
      return {
        title: `${SITE_NAME}: ROUNDS ranked stats, live games and leaderboards`,
        description: "Who's online in ROUNDS right now, live ranked games, leaderboards, player stats and card win rates for Sid's Competitive Rounds, the ranked ROUNDS mod.",
        path: '/',
        index: true,
        ogType: 'website',
      }
    case 'leaderboards-root':
      return pageMeta({ kind: 'leaderboard', mode: '1v1' })
    case 'leaderboard': {
      const mode = BOARD_MODES.find((x) => x.id === m.mode)
      if (!mode) return pageMeta({ kind: 'not-found' })
      const path = `/leaderboards/${mode.id}`
      return mode.ranked
        ? {
            title: titled(`ROUNDS ${mode.label} ranked leaderboard: top players by rating`),
            description: `The top ROUNDS ${mode.label} players in Sid's Competitive Rounds, ordered by rating, with win rates, records and rank tiers. Updated every minute.`,
            path,
            index: true,
            ogType: 'website',
          }
        : {
            title: titled(`ROUNDS ${mode.label} leaderboard: top players`),
            description: `The ROUNDS ${mode.label} leaderboard in Sid's Competitive Rounds: one player against a duo, with games played and win-loss records. Updated every minute.`,
            path,
            index: true,
            ogType: 'website',
          }
    }
    case 'results':
      return {
        title: titled('ROUNDS match results: latest ranked games'),
        description: "The latest ROUNDS games in Sid's Competitive Rounds: 1v1, 2v2, FFA and 1v2 results with scores and rating changes, newest first.",
        path: '/results',
        index: true,
        ogType: 'website',
      }
    case 'tournaments':
      return {
        title: titled('ROUNDS tournaments: weekly brackets and winners'),
        description: "Weekly and async ROUNDS tournaments in Sid's Competitive Rounds: current signups, brackets, time votes and past winners.",
        path: '/tournaments',
        index: true,
        ogType: 'website',
      }
    case 'tournament':
      return {
        title: titled('Tournament game details'),
        description: "Game-by-game details from a ROUNDS tournament bracket in Sid's Competitive Rounds.",
        path: `/tournaments/${m.id}`,
        index: false,
        ogType: 'website',
      }
    case 'cards':
      return {
        title: titled('ROUNDS card win rates: the best cards in ranked play'),
        description: `Win, pick and pass rates for ${facts.cardCount ? `all ${facts.cardCount} ROUNDS cards` : 'every ROUNDS card'} across ranked and casual games of Sid's Competitive Rounds. See which cards win most.`,
        path: '/cards',
        index: true,
        ogType: 'website',
      }
    case 'card': {
      const c = facts.card
      const name = c?.name ?? slugToName(m.slug)
      // Upstream rows can lack a number or the rarity: those would print "NaN%" or "(undefined)", so use the plain line.
      const described = c && c.rarity && [c.win_rate, c.times_picked, c.pass_rate].every(Number.isFinite)
      return {
        title: titled(`${name}: ROUNDS card win rate and stats`),
        description: described
          ? `${c.name} (${c.rarity}) in ROUNDS: ${percent(c.win_rate)} win rate, picked ${count(c.times_picked)} times and passed ${percent(c.pass_rate)} of the time in Sid's Competitive Rounds ranked and casual games.`
          : `Win rate, pick rate and the players who win most with ${name}, a ROUNDS card, across ranked and casual games of Sid's Competitive Rounds.`,
        path: `/cards/${c ? cardSlug(c.name) : cardSlug(m.slug)}`,
        index: true,
        ogType: 'website',
      }
    }
    case 'guide':
      return {
        title: titled("How to play ranked ROUNDS: install Sid's Competitive Rounds"),
        description: "How to install and play Sid's Competitive Rounds, the ranked ROUNDS mod: r2modman or the Windows installer, ranked 1v1, 2v2 and FFA, and 25 rank tiers.",
        path: '/guide',
        index: true,
        ogType: 'article',
      }
    case 'about':
      return {
        title: titled('About SCRmod and privacy'),
        description: 'What SCRmod is, where its ROUNDS data comes from, and how it handles privacy: appearing offline, hidden gold and deleting your data.',
        path: '/about',
        index: true,
        ogType: 'website',
      }
    case 'watch':
      return {
        title: titled('ROUNDS live stream: ranked games and tournaments'),
        description: "Watch Sid's Competitive Rounds live: ranked ROUNDS games and tournaments streamed on Twitch and YouTube, plus the latest broadcasts to catch up on.",
        path: '/watch',
        index: true,
        ogType: 'website',
      }
    case 'player': {
      const name = facts.player?.display_name || 'Player'
      return {
        title: titled(`${name}: ROUNDS ranked stats`),
        description: playerLine(facts.player) ?? "ROUNDS ranked stats from Sid's Competitive Rounds.",
        path: `/players/${m.id}`,
        index: false,
        ogType: 'profile',
      }
    }
    case 'not-found':
      return { title: titled('Not found'), description: "That page doesn't exist on SCRmod.", path: null, index: false, ogType: 'website' }
  }
}
