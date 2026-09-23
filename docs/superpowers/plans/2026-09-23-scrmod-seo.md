# SCRmod search visibility and live stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every public SCRmod page its own server-rendered title, description, canonical URL, link preview, structured data and crawlable content; add `robots.txt`, `sitemap.xml`, a ranked-ROUNDS guide, a page per card; and show the community's live stream.

**Architecture:** A pure shared module (`src/shared/seo.ts`) turns a route and its data into page metadata for both the server and the React app. The Hono server's SPA fallback resolves the route, loads its data through the same cached loaders the API uses (capped at 250 ms), and fills two marked regions of `index.html` with head tags and a light HTML shell that React replaces on load. The stream is a separate `/api/stream` endpoint (Twitch Helix + YouTube feed) and a click-to-play card.

**Tech Stack:** TypeScript, Hono on Node, React 19, react-router, TanStack Query, Vitest + Testing Library (jsdom), esbuild, Vite.

**Spec:** `docs/superpowers/specs/2026-09-23-scrmod-seo-design.md`

## Global Constraints

- Working copy: `C:\Users\notni\Desktop\Updated\SCR-Hub`, branch `seo` (off `main`, which includes PR #4). Run `npm ci` once before Task 1.
- Player profiles: `noindex, follow` (meta tag and `X-Robots-Tag` header); never in the sitemap; never in structured data.
- Titles lead with "ROUNDS"; every title ends ` · SCRmod` except Home's (`SCRmod: ROUNDS ranked stats, live games and leaderboards`).
- Shell data wait: **250 ms** per page request, then render generic text. Never an error page because of a slow or failing upstream.
- Everything dynamic written into HTML is escaped; JSON-LD has `<` as `\u003c`.
- The shell shows only content the app itself shows after loading (no crawler-only text).
- Guide facts: mod v1.40.3, checked 2026-09-23; ROUNDS v1.1.2 only; BepInEx 5.4.1901; not compatible with other BepInEx mods; 25 tiers Beginner I to Grand Master V; FFA 3-10 players, first to 5 points; 1v2 is an unranked beta; controls F5 / T / Esc / Tab.
- Descriptions are 120-160 characters.
- Accuracy over the spec's wording: the leaderboard intro says "ordered by rating" (the README only says Glicko-2 for 1v1 and 2v2); the 1v2 boards get their own title and intro because 1v2 is unranked; a card's description gives its all-games win rate (the stat isn't ranked-only).
- Deliberate deviations from the spec's file layout: the guide content lives in `src/shared/guide.ts` (the server renders it too, and server code doesn't import from `src/web`). The client-side `/leaderboards` → `/leaderboards/1v1` `Navigate` stays for in-app navigation and the Vite dev server; the server answers direct requests with the 301.
- Only facts from the README and Thunderstore page go into the guide. Anything not confirmed there stays out.
- External links: Thunderstore `https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/`, GitHub `https://github.com/SidNDeed/SidsCompetitiveRounds`, Discord `https://discord.gg/4tsWadH6tc`, Twitch `https://www.twitch.tv/sidscompetitiverounds`, YouTube `https://www.youtube.com/@SidsCompetitiveRounds`, Steam `https://store.steampowered.com/app/1557740/ROUNDS/`.
- Stream defaults: Twitch login `sidscompetitiverounds`, YouTube channel id `UCz9MIFturPcCSJsFFzgyBxw`. No request to Twitch or YouTube from the browser until the visitor presses play.
- Commit messages follow the repo's style: a plain sentence ("Add …", "Serve …"), no prefixes, no attribution lines.
- The design system in `DESIGN.md` holds: spacing tokens, the orange band only for "you are here", tabular figures for numbers.

## File Structure

**Shared (used by server and web)**
- `src/shared/links.ts`: external URLs.
- `src/shared/seo.ts`: card slugs, route matching, page metadata, intro lines, board modes.
- `src/shared/guide.ts`: the guide's content as data.
- `src/shared/brand.ts`: wordmark geometry, footer note, primary navigation.
- `src/shared/hub-types.ts` (modify): `CardPageData`, `StreamData` and friends.

**Server**
- `src/server/routes/{cards,boards,home,tournaments,players}.ts` (modify): export named loaders.
- `src/server/routes/card.ts`: `loadCardPage` and `GET /api/card/:slug`.
- `src/server/seo/html.ts`: escaping, JSON-LD script, template filling.
- `src/server/seo/jsonld.ts`: structured-data builders.
- `src/server/seo/site.ts`: site URL (origin + base path).
- `src/server/seo/head.ts`: head tags.
- `src/server/seo/shell.ts`: shell HTML per route.
- `src/server/seo/page.ts`: route → data (with the 250 ms cap) → status, head, shell.
- `src/server/seo/crawl.ts`: `robots.txt`, `sitemap.xml`.
- `src/server/seo/host.ts`: canonical-host redirect middleware.
- `src/server/stream.ts`: Twitch and YouTube clients, `GET /api/stream`.
- `src/server/{env,app,static,node}.ts` (modify).

**Web**
- `src/web/index.html`, `src/web/lib/title.ts`, `src/web/App.tsx`, `src/web/api/{hooks,types}.ts`, `src/web/components/{Layout,Wordmark,Icon}.tsx` (modify).
- `src/web/pages/{Home,Leaderboards,Results,Tournaments,Cards,About,NotFound,Player}.tsx` (modify).
- `src/web/pages/Guide.tsx`, `src/web/pages/Card.tsx`, `src/web/components/Stream.tsx` (create).
- `src/web/styles/base.css` (modify).

**Tests**
- Server: `tests/server/{loaders,seo-meta,seo-html,seo-jsonld,card-route,env-seo,seo-head,seo-shell,seo-pages,crawl,host,stream}.test.ts`; `tests/server/helpers/fakeUpstream.ts` (modify).
- Web: `tests/web/{seo-titles,guide,card-page,stream}.test.tsx`; `tests/web/cards.test.tsx` (modify).

---

## Phase A: shared foundations

### Task 1: Named data loaders shared by the API routes and the pages

**Files:**
- Modify: `src/server/routes/cards.ts`, `src/server/routes/boards.ts`, `src/server/routes/home.ts`, `src/server/routes/tournaments.ts`, `src/server/routes/players.ts`
- Test: `tests/server/loaders.test.ts`

**Interfaces:**
- Produces:
  - `loadCards(d: RouteDeps, filter?: CardFilter, sort?: string, order?: 'asc' | 'desc'): Promise<CachedResult<CardStat[]>>` and `type CardFilter = 'all' | 'ranked' | 'casual'` (cards.ts)
  - `loadCardLeaders(d): Promise<CachedResult<{ sweepers: CardLeader[]; winners: CardLeader[] }>>` (cards.ts)
  - `type BoardData`, `loadBoard(d, mode: string, inactive?: boolean): Promise<CachedResult<BoardData> | null>`, `loadResults(d, limit: number): Promise<CachedResult<MultimodeRecent>>` (boards.ts; its `MODES` map stays private)
  - `loadHome(d): Promise<{ data: HomeData; g: { errors: string[]; stale: boolean; fetched_at: number } }>` (home.ts)
  - `loadTournaments(d)`, `loadTournamentHistory(d)` (same `{ data, g }` shape), `loadBracket(d, id: string): Promise<CachedResult<BracketDetail>>` (tournaments.ts)
  - `loadProfile(d, id: string, viewer?: string): Promise<CachedResult<Record<string, unknown>>>` (masked, players.ts)

- [ ] **Step 1: Install and write the failing test**

Run: `npm ci`

Create `tests/server/loaders.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { loadCardLeaders, loadCards } from '../../src/server/routes/cards'
import { loadBoard, loadResults } from '../../src/server/routes/boards'
import { loadHome } from '../../src/server/routes/home'
import { loadBracket, loadTournamentHistory, loadTournaments } from '../../src/server/routes/tournaments'
import { loadProfile } from '../../src/server/routes/players'

const ID = '76561199311926326'
const UUID = '0b7c0a6e-1f2d-4c5e-9a8b-7c6d5e4f3a2b'
const hits = (calls: Array<{ url: URL }>, path: string) => calls.filter((c) => c.url.pathname === `/api/v1${path}`).length

describe('named loaders share the API routes cache entries', () => {
  it('cards, card leaders, a board and results', async () => {
    const { app, deps, fake } = makeApp({
      '/cards': [{ card_name: 'Poison', card_rarity: 'Common', times_picked: 10, win_rate: 0.5, pass_rate: 0.3 }],
      '/cards/leaders-summary': { sweepers: ['Poison|Stan|3'], winners: [] },
      '/leaderboard': { entries: [], total_players: 0 },
      '/series/recent-multimode': { entries: [] },
    })
    expect((await loadCards(deps, 'all')).value[0].card_name).toBe('Poison')
    expect((await loadCardLeaders(deps)).value.sweepers).toEqual([{ card: 'Poison', player: 'Stan', count: 3 }])
    expect((await loadBoard(deps, '1v1'))?.value).toEqual({ entries: [], total_players: 0 })
    await loadResults(deps, 100)
    await app.request('/api/cards')
    await app.request('/api/cards/leaders')
    await app.request('/api/leaderboard/1v1')
    await app.request('/api/results?limit=100')
    expect(hits(fake.calls, '/cards')).toBe(1)
    expect(hits(fake.calls, '/cards/leaders-summary')).toBe(1)
    expect(hits(fake.calls, '/leaderboard')).toBe(1)
    expect(hits(fake.calls, '/series/recent-multimode')).toBe(1)
    expect(await loadBoard(deps, 'nope')).toBeNull()
  })

  it('home, tournaments, history, a bracket and a profile', async () => {
    const { app, deps, fake } = makeApp({
      '/presence/online': { online_count: 2, online: [], recent: [] },
      '/tournaments/current': { tournament_id: null },
      '/tournaments/history': [],
      '/tournaments/history-detail': { tournaments: [] },
      [`/tournaments/${UUID}/bracket-detail`]: { matches: [] },
      [`/players/${ID}`]: { steam_id: ID, display_name: 'NotNic', hide_gold: true, gold_earned: 5 },
    })
    expect((await loadHome(deps)).data.presence.online_count).toBe(2)
    await loadTournaments(deps)
    await loadTournamentHistory(deps)
    await loadBracket(deps, UUID)
    expect((await loadProfile(deps, ID)).value.gold_hidden).toBe(true)
    await app.request('/api/home')
    await app.request('/api/tournaments')
    await app.request('/api/tournaments/history')
    await app.request(`/api/tournaments/${UUID}/bracket`)
    await app.request(`/api/players/${ID}`)
    expect(hits(fake.calls, '/presence/online')).toBe(1)
    expect(hits(fake.calls, '/tournaments/current')).toBe(2) // sync and async are two keys
    expect(hits(fake.calls, '/tournaments/history')).toBe(1)
    expect(hits(fake.calls, `/tournaments/${UUID}/bracket-detail`)).toBe(1)
    expect(hits(fake.calls, `/players/${ID}`)).toBe(1)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/loaders.test.ts`
Expected: FAIL, e.g. `SyntaxError: The requested module '../../src/server/routes/cards' does not provide an export named 'loadCardLeaders'`.

- [ ] **Step 3: Extract the loaders**

In `src/server/routes/cards.ts`, change the imports and add the loaders above `registerCardRoutes`:

```ts
import type { Hono } from 'hono'
import type { CardLeadersSummary, CardStat } from '../../shared/api-types'
import { TTL, type CachedResult } from '../cache'
import { errorResponse, loaderFor, ok, type RouteDeps } from './common'
```

```ts
export type CardFilter = 'all' | 'ranked' | 'casual'

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
```

Replace the two route bodies:

```ts
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
```

In `src/server/routes/boards.ts`, replace the two imports at the top and add after the `MODES` map:

```ts
import type { FfaLeaderboard, Leaderboard, MultimodeRecent, OvtLeaderboard, RecentSeriesList, TeamLeaderboard } from '../../shared/api-types'
import { TTL, type CachedResult } from '../cache'
```

```ts
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
```

and replace the leaderboard and results route bodies:

```ts
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
```

In `src/server/routes/home.ts`, move the body of the `/api/home` handler into:

```ts
/** Everything the home page shows, from the same cache keys as /api/home. */
export async function loadHome(d: RouteDeps) {
  const load = loaderFor(d)
  const g = await gather(
    {
      presence: load<PresenceOnline>('home:presence', TTL.LIVE, '/presence/online'),
      queue: load<QueueCount>('home:queue', TTL.LIVE, '/queue/count'),
      team_queue: load<TeamQueueCount>('home:team-queue', TTL.LIVE, '/team/queue/count'),
      series_1v1: load<ActiveSeriesList>('home:series-1v1', TTL.LIVE, '/series/active'),
      series_2v2: load<ActiveTeamSeriesList>('home:series-2v2', TTL.LIVE, '/team/series/active'),
      ffa_lobbies: load<FfaLobbies>('home:ffa-lobbies', TTL.LIVE, '/ffa/lobbies'),
      spectate: load<SpectateGames>('home:spectate', TTL.LIVE, '/spectate/games'),
      results: load<MultimodeRecent>('results:20', TTL.RESULTS, '/series/recent-multimode', { limit: 20 }),
      maintenance: load<MaintenanceStatus>('home:maintenance', TTL.LIVE, '/admin/maintenance/status'),
      alerts: load<AlertsActive>('home:alerts', TTL.LIVE, '/alerts/active'),
    },
    d.now,
  )
  const v = g.values
  const data: HomeData = {
    presence: v.presence ?? { online_count: 0, online: [], recent: [] },
    queue: {
      ranked_searching: v.queue?.searching ?? 0,
      team_searching: v.team_queue?.searching ?? 0,
      online: v.queue?.online ?? v.presence?.online_count ?? 0,
    },
    live: {
      series_1v1: v.series_1v1?.series ?? [],
      series_2v2: v.series_2v2?.series ?? [],
      ffa_lobbies: v.ffa_lobbies?.lobbies ?? [],
      spectate: v.spectate?.games ?? [],
    },
    results: v.results?.entries ?? [],
    maintenance: v.maintenance?.in_maintenance ?? false,
    alerts: v.alerts?.alerts ?? [],
  }
  return { data, g }
}

export function registerHomeRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/home', async (c) => {
    const { data, g } = await loadHome(d)
    return gathered(c, g, data, 5)
  })
}
```

In `src/server/routes/tournaments.ts`:

```ts
import type { BracketDetail, TournamentCurrent, TournamentHistoryDetail, TournamentHistoryRow } from '../../shared/api-types'

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
```

In `src/server/routes/players.ts`:

```ts
/** A profile with the privacy masks applied, under the same cache key the /api/players/:id route uses. */
export async function loadProfile(d: RouteDeps, id: string, viewer?: string) {
  // The cache holds the profile with the discord fields already gone; `hide_gold` is
  // held back so `maskProfile` can still turn it into `gold_hidden` on the way out.
  const r = await loaderFor(d)<Record<string, unknown>>(
    `player:${id}:${viewer ?? ''}`,
    TTL.PLAYER,
    `/players/${id}`,
    { viewer_steam_id: viewer },
    (raw) => scrubPrivate(raw as Record<string, unknown>, KEEP_FOR_PROFILE_MASK),
  )
  return { ...r, value: maskProfile(r.value) }
}
```

and in the `/api/players/:id` handler replace the `try` body with `return ok(c, await loadProfile(d, id, viewer))`.

- [ ] **Step 4: Run the new test and the whole server suite**

Run: `npx vitest run tests/server/loaders.test.ts && npx vitest run --project server`
Expected: all PASS (the existing route tests are unchanged and still green).

- [ ] **Step 5: Commit**

```bash
git add src/server/routes tests/server/loaders.test.ts
git commit -m "Expose the API routes' data loads as named loaders"
```

### Task 2: Links, card slugs, route matching and page metadata

**Files:**
- Create: `src/shared/links.ts`, `src/shared/seo.ts`
- Test: `tests/server/seo-meta.test.ts`

**Interfaces:**
- Produces (seo.ts): `SITE_NAME`, `BOARD_MODES: ReadonlyArray<{ id: string; label: string; ranked: boolean }>`, `INTROS`, `cardSlug(name)`, `slugToName(slug)`, `type RouteMatch`, `matchRoute(path)`, `type PageMeta = { title; description; path: string | null; index: boolean; ogType: 'website' | 'article' | 'profile' }`, `type CardFacts`, `type PlayerFacts`, `type MetaFacts`, `pageMeta(match, facts?)`.
- Produces (links.ts): `LINKS` with keys `thunderstore, github, discord, twitch, youtube, steam`.

- [ ] **Step 1: Write the failing test**

Create `tests/server/seo-meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cardSlug, matchRoute, pageMeta, slugToName } from '../../src/shared/seo'

describe('cardSlug', () => {
  it('lowercases, strips accents and joins words with single dashes', () => {
    expect(cardSlug('Big Bullet')).toBe('big-bullet')
    expect(cardSlug('Glass Cannon!')).toBe('glass-cannon')
    expect(cardSlug('Défense')).toBe('defense')
    expect(cardSlug('  --A   B--  ')).toBe('a-b')
    expect(slugToName('big-bullet')).toBe('Big Bullet')
  })
})

describe('matchRoute', () => {
  it('knows every page and rejects everything else', () => {
    expect(matchRoute('/')).toEqual({ kind: 'home' })
    expect(matchRoute('/leaderboards')).toEqual({ kind: 'leaderboards-root' })
    expect(matchRoute('/leaderboards/1v2-duo/')).toEqual({ kind: 'leaderboard', mode: '1v2-duo' })
    expect(matchRoute('/leaderboards/3v3')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/results')).toEqual({ kind: 'results' })
    expect(matchRoute('/tournaments')).toEqual({ kind: 'tournaments' })
    expect(matchRoute('/tournaments/0B7C0A6E-1F2D-4C5E-9A8B-7C6D5E4F3A2B')).toEqual({ kind: 'tournament', id: '0b7c0a6e-1f2d-4c5e-9a8b-7c6d5e4f3a2b' })
    expect(matchRoute('/tournaments/nope')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/cards')).toEqual({ kind: 'cards' })
    expect(matchRoute('/cards/Big%20Bullet')).toEqual({ kind: 'card', slug: 'Big Bullet' })
    expect(matchRoute('/cards/%E0%A4%A')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/guide')).toEqual({ kind: 'guide' })
    expect(matchRoute('/about')).toEqual({ kind: 'about' })
    expect(matchRoute('/players/76561199311926326')).toEqual({ kind: 'player', id: '76561199311926326' })
    expect(matchRoute('/players/123')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/cards/a/b')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/wp-admin')).toEqual({ kind: 'not-found' })
  })
})

describe('pageMeta', () => {
  it('writes the planned titles', () => {
    expect(pageMeta({ kind: 'home' }).title).toBe('SCRmod: ROUNDS ranked stats, live games and leaderboards')
    expect(pageMeta({ kind: 'leaderboard', mode: '2v2' }).title).toBe('ROUNDS 2v2 ranked leaderboard: top players by rating · SCRmod')
    expect(pageMeta({ kind: 'leaderboard', mode: '1v2-solo' }).title).toBe('ROUNDS 1v2 solo leaderboard: top players · SCRmod')
    expect(pageMeta({ kind: 'cards' }).title).toBe('ROUNDS card win rates: the best cards in ranked play · SCRmod')
    expect(pageMeta({ kind: 'guide' }).title).toBe("How to play ranked ROUNDS: install Sid's Competitive Rounds · SCRmod")
    expect(pageMeta({ kind: 'leaderboards-root' }).path).toBe('/leaderboards/1v1')
    expect(pageMeta({ kind: 'leaderboard', mode: 'zzz' }).index).toBe(false)
  })

  it('builds a card page from its facts, canonical slug included', () => {
    const m = pageMeta({ kind: 'card', slug: 'Big Bullet' }, { card: { name: 'Big Bullet', rarity: 'Common', win_rate: 0.523, times_picked: 1234, pass_rate: 0.31 } })
    expect(m.title).toBe('Big Bullet: ROUNDS card win rate and stats · SCRmod')
    expect(m.description).toBe("Big Bullet (Common) in ROUNDS: 52% win rate, picked 1,234 times and passed 31% of the time in Sid's Competitive Rounds games.")
    expect(m.path).toBe('/cards/big-bullet')
    expect(pageMeta({ kind: 'card', slug: 'big-bullet' }).title).toBe('Big Bullet: ROUNDS card win rate and stats · SCRmod')
  })

  it('keeps player pages out of the index and summarises them for link previews', () => {
    const m = pageMeta({ kind: 'player', id: '76561199311926326' }, { player: { display_name: 'NotNic', rating: 1101.8, rank_name: 'Beginner I', standing: 189, standing_population: 198, ranked_series_wins: 45, ranked_series_losses: 95 } })
    expect(m.title).toBe('NotNic: ROUNDS ranked stats · SCRmod')
    expect(m.description).toBe('1102 rating · Beginner I · #189 of 198 · 45-95 ranked series')
    expect(m.index).toBe(false)
    expect(m.ogType).toBe('profile')
    expect(pageMeta({ kind: 'player', id: '76561199311926326' }).title).toBe('Player: ROUNDS ranked stats · SCRmod')
  })

  it('gives every indexed page a 120-160 character description', () => {
    const pages = [{ kind: 'home' }, { kind: 'leaderboard', mode: '1v1' }, { kind: 'leaderboard', mode: '1v2' }, { kind: 'results' }, { kind: 'tournaments' }, { kind: 'cards' }, { kind: 'guide' }, { kind: 'about' }] as const
    for (const p of pages) {
      const m = pageMeta(p)
      expect(m.index).toBe(true)
      expect(m.description.length).toBeGreaterThanOrEqual(120)
      expect(m.description.length).toBeLessThanOrEqual(160)
    }
    expect(pageMeta({ kind: 'not-found' })).toMatchObject({ index: false, path: null })
    expect(pageMeta({ kind: 'tournament', id: 'x' }).index).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/seo-meta.test.ts`
Expected: FAIL, `Failed to resolve import "../../src/shared/seo"`.

- [ ] **Step 3: Write the modules**

Create `src/shared/links.ts`:

```ts
/** Outside places SCRmod links to and names in its structured data. */
export const LINKS = {
  thunderstore: 'https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/',
  github: 'https://github.com/SidNDeed/SidsCompetitiveRounds',
  discord: 'https://discord.gg/4tsWadH6tc',
  twitch: 'https://www.twitch.tv/sidscompetitiverounds',
  youtube: 'https://www.youtube.com/@SidsCompetitiveRounds',
  steam: 'https://store.steampowered.com/app/1557740/ROUNDS/',
} as const
```

Create `src/shared/seo.ts`:

```ts
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
} as const

/** "Big Bullet" → "big-bullet": lowercase, accents stripped, runs of anything else become one dash. */
export function cardSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
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
  | { kind: 'player'; id: string }
  | { kind: 'not-found' }

const STEAM_ID = /^\d{17}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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
      return {
        title: titled(`${name}: ROUNDS card win rate and stats`),
        description: c
          ? `${c.name} (${c.rarity}) in ROUNDS: ${percent(c.win_rate)} win rate, picked ${count(c.times_picked)} times and passed ${percent(c.pass_rate)} of the time in Sid's Competitive Rounds games.`
          : `Win rate, pick rate and the top players of the ROUNDS card ${name} in Sid's Competitive Rounds.`,
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
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/server/seo-meta.test.ts`
Expected: PASS. (The descriptions as written measure 120-151 characters; the shortest, Tournaments, is exactly 120, so don't trim it.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/links.ts src/shared/seo.ts tests/server/seo-meta.test.ts
git commit -m "Add shared route matching, card slugs and page metadata"
```

### Task 3: HTML escaping and template filling

**Files:**
- Create: `src/server/seo/html.ts`
- Test: `tests/server/seo-html.test.ts`

**Interfaces:**
- Produces: `esc(value: unknown): string`, `jsonLdScript(data: unknown): string`, `HEAD_START`, `HEAD_END`, `BODY_MARK`, `fillTemplate(template: string, head: string, body: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { BODY_MARK, HEAD_END, HEAD_START, esc, fillTemplate, jsonLdScript } from '../../src/server/seo/html'

describe('esc', () => {
  it('escapes everything that could break out of text or an attribute', () => {
    expect(esc(`</title><script>alert("x")</script> & 'y'`)).toBe('&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;')
    expect(esc(42)).toBe('42')
    expect(esc(null)).toBe('')
  })
})

describe('jsonLdScript', () => {
  it('cannot be closed early by the data', () => {
    const out = jsonLdScript({ name: '</script><script>alert(1)</script>', sep: '\u2028' })
    expect(out.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(out.match(/<\/script>/g)).toHaveLength(1)
    expect(out).toContain('\\u003c/script>')
    expect(out).toContain('\\u2028')
    expect(JSON.parse(out.slice(35, -9).replace(/\\u003c/g, '<'))).toMatchObject({ name: '</script><script>alert(1)</script>' })
  })
})

describe('fillTemplate', () => {
  const template = `<head>${HEAD_START}<title>SCRmod</title>${HEAD_END}</head><body><div id="root">${BODY_MARK}</div></body>`
  it('replaces the head region and fills the root', () => {
    expect(fillTemplate(template, '<title>X</title>', '<main>hi</main>')).toBe('<head><title>X</title></head><body><div id="root"><main>hi</main></div></body>')
  })
  it('leaves a template without markers alone', () => {
    expect(fillTemplate('<title>SCRmod</title><div id="root"></div>', '<title>X</title>', '<main/>')).toBe('<title>SCRmod</title><div id="root"></div>')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/seo-html.test.ts`
Expected: FAIL, cannot resolve `../../src/server/seo/html`.

- [ ] **Step 3: Implement**

```ts
/** Text and attribute escaping for everything the server writes into HTML. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** A JSON-LD block that no string inside the data can close early. */
export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return `<script type="application/ld+json">${json}</script>`
}

export const HEAD_START = '<!--seo:head:start-->'
export const HEAD_END = '<!--seo:head:end-->'
export const BODY_MARK = '<!--seo:body-->'

/** Swaps the marked head region for `head` and the body marker for `body`; a template without markers is returned as is. */
export function fillTemplate(template: string, head: string, body: string): string {
  let out = template
  const a = out.indexOf(HEAD_START)
  const b = out.indexOf(HEAD_END)
  if (a >= 0 && b > a) out = out.slice(0, a) + head + out.slice(b + HEAD_END.length)
  const m = out.indexOf(BODY_MARK)
  if (m >= 0) out = out.slice(0, m) + body + out.slice(m + BODY_MARK.length)
  return out
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/server/seo-html.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/seo/html.ts tests/server/seo-html.test.ts
git commit -m "Add escaping and template filling for server-rendered pages"
```

### Task 4: Structured data builders

**Files:**
- Create: `src/server/seo/jsonld.ts`
- Test: `tests/server/seo-jsonld.test.ts`

**Interfaces:**
- Consumes: `LINKS` (Task 2).
- Produces: `siteGraph(site: string)`, `breadcrumbs(site, items: Array<{ name: string; path: string }>)`, `article(site, a: { headline: string; description: string; path: string; dateModified: string })`, `itemList(site, items: Array<{ name: string; path: string }>)`. `site` is origin + base path with no trailing slash.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { article, breadcrumbs, itemList, siteGraph } from '../../src/server/seo/jsonld'

const SITE = 'https://scrmod.com'

describe('structured data', () => {
  it('describes the site as about ROUNDS and the mod, tied to their official accounts', () => {
    const g = siteGraph(SITE) as Record<string, any>
    expect(g['@type']).toBe('WebSite')
    expect(g.url).toBe('https://scrmod.com/')
    expect(g.alternateName).toContain("Sid's Competitive Rounds stats")
    const [game, mod] = g.about
    expect(game).toMatchObject({ '@type': 'VideoGame', name: 'ROUNDS', sameAs: ['https://store.steampowered.com/app/1557740/ROUNDS/'] })
    expect(mod['@type']).toBe('SoftwareApplication')
    expect(mod.sameAs).toContain('https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/')
    expect(mod.publisher.sameAs).toEqual(['https://www.twitch.tv/sidscompetitiverounds', 'https://www.youtube.com/@SidsCompetitiveRounds', 'https://discord.gg/4tsWadH6tc'])
  })

  it('builds breadcrumbs, an article and an item list with absolute URLs', () => {
    const b = breadcrumbs(SITE, [{ name: 'Home', path: '/' }, { name: 'Cards', path: '/cards' }]) as Record<string, any>
    expect(b.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Cards', item: 'https://scrmod.com/cards' })
    const a = article(SITE, { headline: 'H', description: 'D', path: '/guide', dateModified: '2026-09-23' }) as Record<string, any>
    expect(a).toMatchObject({ '@type': 'Article', headline: 'H', dateModified: '2026-09-23', mainEntityOfPage: 'https://scrmod.com/guide' })
    const l = itemList(SITE, [{ name: 'Big Bullet', path: '/cards/big-bullet' }]) as Record<string, any>
    expect(l.itemListElement[0]).toEqual({ '@type': 'ListItem', position: 1, name: 'Big Bullet', url: 'https://scrmod.com/cards/big-bullet' })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/seo-jsonld.test.ts`
Expected: FAIL, cannot resolve `../../src/server/seo/jsonld`.

- [ ] **Step 3: Implement**

```ts
import { LINKS } from '../../shared/links'

const url = (site: string, path: string) => (path === '/' ? `${site}/` : `${site}${path}`)

/**
 * The site-wide graph: SCRmod is about the game ROUNDS and the mod Sid's Competitive Rounds, whose community
 * publishes on Twitch, YouTube and Discord. These links are what tie the site to ROUNDS searches.
 */
export function siteGraph(site: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site}/#site`,
    name: 'SCRmod',
    alternateName: ['SCR mod', "Sid's Competitive Rounds stats"],
    url: `${site}/`,
    inLanguage: 'en',
    about: [
      { '@type': 'VideoGame', '@id': `${site}/#rounds`, name: 'ROUNDS', sameAs: [LINKS.steam], publisher: { '@type': 'Organization', name: 'Landfall' } },
      {
        '@type': 'SoftwareApplication',
        '@id': `${site}/#mod`,
        name: "Sid's Competitive Rounds",
        applicationCategory: 'GameApplication',
        operatingSystem: 'Windows',
        sameAs: [LINKS.thunderstore, LINKS.github],
        publisher: { '@type': 'Organization', name: "Sid's Competitive Rounds", sameAs: [LINKS.twitch, LINKS.youtube, LINKS.discord] },
      },
    ],
  }
}

export function breadcrumbs(site: string, items: Array<{ name: string; path: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: url(site, it.path) })),
  }
}

export function article(site: string, a: { headline: string; description: string; path: string; dateModified: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    dateModified: a.dateModified,
    mainEntityOfPage: url(site, a.path),
    about: { '@id': `${site}/#mod` },
    publisher: { '@type': 'Organization', name: 'SCRmod', url: `${site}/` },
  }
}

export function itemList(site: string, items: Array<{ name: string; path: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: url(site, it.path) })),
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/server/seo-jsonld.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/seo/jsonld.ts tests/server/seo-jsonld.test.ts
git commit -m "Add structured data builders"
```

### Task 5: Card page data and `GET /api/card/:slug`

**Files:**
- Create: `src/server/routes/card.ts`
- Modify: `src/shared/hub-types.ts`, `src/server/app.ts`, `tests/server/helpers/fakeUpstream.ts`
- Test: `tests/server/card-route.test.ts`

**Interfaces:**
- Consumes: `loadCards`, `loadCardLeaders`, `CardLeader` (Task 1), `cardSlug` (Task 2).
- Produces:
  - `interface CardPageData { slug: string; card: CardStat; ranked: CardStat | null; casual: CardStat | null; winners: CardLeader[]; sweepers: CardLeader[]; prev: { name: string; slug: string } | null; next: { name: string; slug: string } | null }` in `src/shared/hub-types.ts` (import `CardLeader` as a type from `../server/routes/cards`, the same way `src/web/api/types.ts` already does).
  - `type CardLookup = { kind: 'found'; result: CachedResult<CardPageData> } | { kind: 'redirect'; slug: string } | { kind: 'missing' }`
  - `loadCardPage(d: RouteDeps, requested: string): Promise<CardLookup>`, `registerCardPageRoute(app, d)`.
  - The fake upstream passes the request URL to responder functions: `type Responder = (url: URL) => Response | Promise<Response>`.

- [ ] **Step 1: Let fake responders see the URL**

In `tests/server/helpers/fakeUpstream.ts`, change `export type Responder = () => Response | Promise<Response>` to `export type Responder = (url: URL) => Response | Promise<Response>` and `return await (hit as Responder)()` to `return await (hit as Responder)(url)`. Existing responders ignore the argument.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const all = [
  { card_name: 'Poison', card_rarity: 'Common', times_picked: 900, win_rate: 0.43, pass_rate: 0.34, times_offered: 2000, unique_players: 80, sweeps_with_card: 5 },
  { card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 800, win_rate: 0.52, pass_rate: 0.31, times_offered: 1500, unique_players: 70, sweeps_with_card: 9 },
  { card_name: 'Glass Cannon', card_rarity: 'Uncommon', times_picked: 700, win_rate: 0.55, pass_rate: 0.2, times_offered: 1200, unique_players: 60, sweeps_with_card: 4 },
]
const cards = (url: URL) => {
  const r = url.searchParams.get('is_ranked')
  if (r === 'true') return json([{ ...all[1], win_rate: 0.6 }])
  if (r === 'false') return json([])
  return json(all)
}
const leaders = { winners: ['Big Bullet|Sid|42', 'Big Bullet|Stan|50', 'Poison|Nix|3'], sweepers: ['Big Bullet|Stan|7'] }

describe('/api/card/:slug', () => {
  it('returns one card with its ranked split, leaders and neighbours', async () => {
    const { app } = makeApp({ '/cards': cards, '/cards/leaders-summary': leaders })
    const res = await app.request('/api/card/big-bullet')
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.slug).toBe('big-bullet')
    expect(data.card.card_name).toBe('Big Bullet')
    expect(data.ranked.win_rate).toBe(0.6)
    expect(data.casual).toBeNull()
    expect(data.winners).toEqual([{ card: 'Big Bullet', player: 'Stan', count: 50 }, { card: 'Big Bullet', player: 'Sid', count: 42 }])
    expect(data.sweepers).toEqual([{ card: 'Big Bullet', player: 'Stan', count: 7 }])
    expect(data.prev).toEqual({ name: 'Poison', slug: 'poison' })
    expect(data.next).toEqual({ name: 'Glass Cannon', slug: 'glass-cannon' })
  })

  it('answers a display name or odd casing with the canonical card', async () => {
    const { app } = makeApp({ '/cards': cards, '/cards/leaders-summary': leaders })
    expect((await (await app.request('/api/card/Big%20Bullet')).json()).data.slug).toBe('big-bullet')
    expect((await (await app.request('/api/card/BIG-BULLET')).json()).data.slug).toBe('big-bullet')
  })

  it('404s an unknown card and survives a failing ranked list', async () => {
    const { app } = makeApp({ '/cards': (url: URL) => (url.searchParams.get('is_ranked') ? json({ detail: 'x' }, 500) : json(all)) })
    expect((await app.request('/api/card/nope')).status).toBe(404)
    const res = await app.request('/api/card/poison')
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.ranked).toBeNull()
    expect(data.winners).toEqual([])
    expect(data.prev).toBeNull()
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/server/card-route.test.ts`
Expected: FAIL, 404 for `/api/card/big-bullet` (route not registered).

- [ ] **Step 4: Implement**

Add to `src/shared/hub-types.ts`:

```ts
import type { CardStat } from './api-types'
import type { CardLeader } from '../server/routes/cards'

/** One card's page: its stats overall, ranked and casual, who wins with it, and its neighbours by pick count. */
export interface CardPageData {
  slug: string
  card: CardStat
  ranked: CardStat | null
  casual: CardStat | null
  winners: CardLeader[]
  sweepers: CardLeader[]
  prev: { name: string; slug: string } | null
  next: { name: string; slug: string } | null
}
```

(merge the `CardStat` import into the file's existing `./api-types` import if there is one).

Create `src/server/routes/card.ts`:

```ts
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
```

In `src/server/app.ts`, import `registerCardPageRoute` from `./routes/card` and call `registerCardPageRoute(app, routeDeps)` right after `registerCardRoutes(app, routeDeps)`.

- [ ] **Step 5: Run the test and the server suite**

Run: `npx vitest run tests/server/card-route.test.ts && npx vitest run --project server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/card.ts src/shared/hub-types.ts src/server/app.ts tests/server/helpers/fakeUpstream.ts tests/server/card-route.test.ts
git commit -m "Serve one card's page data by slug"
```

### Task 6: Site settings: verification tags, stream configuration, site URL

**Files:**
- Modify: `src/server/env.ts`, `README.md`
- Create: `src/server/seo/site.ts`
- Test: `tests/server/env-seo.test.ts`

**Interfaces:**
- Produces: `Env.googleVerification?: string`, `Env.bingVerification?: string`, `Env.stream: StreamConfig` with `interface StreamConfig { twitchLogin: string; twitchClientId?: string; twitchClientSecret?: string; youtubeChannelId: string; youtubeApiKey?: string }`; `siteUrl(env: Env, requestUrl: string): string` (origin + base path, no trailing slash); `basePrefix(env): string` (`''` or `/hub`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { parseEnv } from '../../src/server/env'
import { basePrefix, siteUrl } from '../../src/server/seo/site'

describe('SEO and stream settings', () => {
  it('defaults the stream channels and leaves keys unset', () => {
    const env = parseEnv({})
    expect(env.stream).toEqual({ twitchLogin: 'sidscompetitiverounds', youtubeChannelId: 'UCz9MIFturPcCSJsFFzgyBxw', twitchClientId: undefined, twitchClientSecret: undefined, youtubeApiKey: undefined })
    expect(env.googleVerification).toBeUndefined()
  })

  it('reads keys and verification codes', () => {
    const env = parseEnv({ TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret', YOUTUBE_API_KEY: 'yt', STREAM_TWITCH_LOGIN: 'other', GOOGLE_SITE_VERIFICATION: 'g', BING_SITE_VERIFICATION: 'b' })
    expect(env.stream).toMatchObject({ twitchLogin: 'other', twitchClientId: 'id', twitchClientSecret: 'secret', youtubeApiKey: 'yt' })
    expect(env.googleVerification).toBe('g')
    expect(env.bingVerification).toBe('b')
  })

  it('builds the site URL from PUBLIC_BASE_URL, else the request, plus the base path', () => {
    expect(siteUrl(parseEnv({ PUBLIC_BASE_URL: 'https://scrmod.com' }), 'http://x.up.railway.app/cards')).toBe('https://scrmod.com')
    expect(siteUrl(parseEnv({}), 'http://localhost:8080/cards')).toBe('http://localhost:8080')
    expect(siteUrl(parseEnv({ BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' }), 'http://a/hub/')).toBe('https://example.org/hub')
    expect(basePrefix(parseEnv({ BASE_PATH: '/hub' }))).toBe('/hub')
    expect(basePrefix(parseEnv({}))).toBe('')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/env-seo.test.ts`
Expected: FAIL (`env.stream` undefined; `site` module missing).

- [ ] **Step 3: Implement**

In `src/server/env.ts` add:

```ts
export interface StreamConfig {
  twitchLogin: string
  twitchClientId?: string
  twitchClientSecret?: string
  youtubeChannelId: string
  youtubeApiKey?: string
}
```

add to `interface Env`:

```ts
  googleVerification?: string
  bingVerification?: string
  stream: StreamConfig
```

and to the object `parseEnv` returns:

```ts
    googleVerification: raw.GOOGLE_SITE_VERIFICATION || undefined,
    bingVerification: raw.BING_SITE_VERIFICATION || undefined,
    stream: {
      twitchLogin: raw.STREAM_TWITCH_LOGIN || 'sidscompetitiverounds',
      twitchClientId: raw.TWITCH_CLIENT_ID || undefined,
      twitchClientSecret: raw.TWITCH_CLIENT_SECRET || undefined,
      youtubeChannelId: raw.STREAM_YOUTUBE_CHANNEL_ID || 'UCz9MIFturPcCSJsFFzgyBxw',
      youtubeApiKey: raw.YOUTUBE_API_KEY || undefined,
    },
```

Create `src/server/seo/site.ts`:

```ts
import type { Env } from '../env'

/** '' at the root, '/hub' under BASE_PATH=/hub: what page links start with. */
export function basePrefix(env: Env): string {
  return env.basePath === '/' ? '' : env.basePath
}

/** The site's absolute URL (origin plus base path, no trailing slash): PUBLIC_BASE_URL when set, else the request's origin. */
export function siteUrl(env: Env, requestUrl: string): string {
  return (env.publicBaseUrl ?? new URL(requestUrl).origin) + basePrefix(env)
}
```

In `README.md`, add rows to the configuration table:

```
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | unset | Search console verification meta tags |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | unset | Twitch app credentials: show when the stream is live |
| `YOUTUBE_API_KEY` | unset | Optional: detect a live YouTube stream (recent videos work without it) |
| `STREAM_TWITCH_LOGIN` | `sidscompetitiverounds` | Twitch channel to show |
| `STREAM_YOUTUBE_CHANNEL_ID` | `UCz9MIFturPcCSJsFFzgyBxw` | YouTube channel to show |
```

and note under the table that `PUBLIC_BASE_URL` also sets the canonical host (other hosts are redirected to it).

- [ ] **Step 4: Run the test and typecheck**

Run: `npx vitest run tests/server/env-seo.test.ts && npm run typecheck`
Expected: PASS; typecheck clean (fix any test helper that builds an `Env` literal by adding `stream`).

- [ ] **Step 5: Commit**

```bash
git add src/server/env.ts src/server/seo/site.ts README.md tests/server/env-seo.test.ts
git commit -m "Add verification, stream and site URL settings"
```

---

## Phase B: server-rendered pages

### Task 7: Head tags

**Files:**
- Create: `src/server/seo/head.ts`
- Test: `tests/server/seo-head.test.ts`

**Interfaces:**
- Consumes: `PageMeta` (Task 2), `esc`, `jsonLdScript` (Task 3).
- Produces: `renderHead(input: { meta: PageMeta; site: string; jsonLd: object[]; verification?: { google?: string; bing?: string } }): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { renderHead } from '../../src/server/seo/head'
import { pageMeta } from '../../src/shared/seo'

const SITE = 'https://scrmod.com'

describe('renderHead', () => {
  it('writes title, description, canonical, robots and link-preview tags', () => {
    const html = renderHead({ meta: pageMeta({ kind: 'cards' }), site: SITE, jsonLd: [{ '@type': 'WebSite' }] })
    expect(html).toContain('<title>ROUNDS card win rates: the best cards in ranked play · SCRmod</title>')
    expect(html).toContain('<link rel="canonical" href="https://scrmod.com/cards" />')
    expect(html).toContain('<meta name="robots" content="index, follow" />')
    expect(html).toContain('<meta property="og:url" content="https://scrmod.com/cards" />')
    expect(html).toContain('<meta property="og:image" content="https://scrmod.com/og.png" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1)
    expect(html).not.toContain('google-site-verification')
  })

  it('marks noindex pages, drops the canonical when there is none, and escapes names', () => {
    const player = renderHead({ meta: pageMeta({ kind: 'player', id: '76561199311926326' }, { player: { display_name: '"><script>x</script>' } }), site: SITE, jsonLd: [] })
    expect(player).toContain('<meta name="robots" content="noindex, follow" />')
    expect(player).toContain('<meta property="og:type" content="profile" />')
    expect(player).not.toContain('<script>x')
    expect(player).toContain('&quot;&gt;&lt;script&gt;x&lt;/script&gt;')
    expect(renderHead({ meta: pageMeta({ kind: 'not-found' }), site: SITE, jsonLd: [] })).not.toContain('rel="canonical"')
  })

  it('adds verification tags when configured', () => {
    const html = renderHead({ meta: pageMeta({ kind: 'home' }), site: SITE, jsonLd: [], verification: { google: 'abc', bing: 'def' } })
    expect(html).toContain('<meta name="google-site-verification" content="abc" />')
    expect(html).toContain('<meta name="msvalidate.01" content="def" />')
    expect(html).toContain('<link rel="canonical" href="https://scrmod.com/" />')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/seo-head.test.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

```ts
import type { PageMeta } from '../../shared/seo'
import { esc, jsonLdScript } from './html'

export interface HeadInput {
  meta: PageMeta
  /** Origin plus base path, no trailing slash. */
  site: string
  jsonLd: object[]
  verification?: { google?: string; bing?: string }
}

/** Everything that goes between the head markers: title, description, canonical, robots, previews, structured data. */
export function renderHead({ meta, site, jsonLd, verification }: HeadInput): string {
  const url = meta.path === null ? null : meta.path === '/' ? `${site}/` : `${site}${meta.path}`
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.index ? 'index, follow' : 'noindex, follow'}" />`,
    url ? `<link rel="canonical" href="${esc(url)}" />` : '',
    `<meta property="og:site_name" content="SCRmod" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    url ? `<meta property="og:url" content="${esc(url)}" />` : '',
    `<meta property="og:image" content="${esc(`${site}/og.png`)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    verification?.google ? `<meta name="google-site-verification" content="${esc(verification.google)}" />` : '',
    verification?.bing ? `<meta name="msvalidate.01" content="${esc(verification.bing)}" />` : '',
    ...jsonLd.map(jsonLdScript),
  ]
  return tags.filter(Boolean).join('\n    ')
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/server/seo-head.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/seo/head.ts tests/server/seo-head.test.ts
git commit -m "Render per-page head tags"
```

### Task 8: Guide content, wordmark and navigation as shared data

**Files:**
- Create: `src/shared/guide.ts`, `src/shared/brand.ts`
- Modify: `src/web/components/Wordmark.tsx`, `src/web/components/Layout.tsx`
- Test: `tests/server/seo-meta.test.ts` (append)

**Interfaces:**
- Produces (guide.ts): `GUIDE_CHECKED = '2026-09-23'`, `GUIDE_MOD_VERSION = '1.40.3'`, `type GuideInline`, `type GuideBlock`, `interface GuideSection`, `GUIDE_TITLE`, `GUIDE_INTRO: GuideInline[]`, `GUIDE: GuideSection[]`.
- Produces (brand.ts): `WORDMARK = { viewBox, left, right, face: { x, y, width, height } }`, `FOOTER_NOTE`, `NAV_LINKS: Array<{ to: string; label: string }>`.

- [ ] **Step 1: Write the failing test**

In `tests/server/seo-meta.test.ts`, add `import { GUIDE, GUIDE_INTRO } from '../../src/shared/guide'` to the imports at the top, and append:

```ts
describe('guide content', () => {
  it('covers the planned sections and links to the mod', () => {
    expect(GUIDE.map((s) => s.id)).toEqual(['before', 'install-r2modman', 'install-windows', 'ranked', 'more', 'controls', 'other-mods', 'links'])
    const links = JSON.stringify([GUIDE_INTRO, GUIDE])
    expect(links).toContain('https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/')
    expect(links).toContain('https://github.com/SidNDeed/SidsCompetitiveRounds')
    expect(links).toContain('https://discord.gg/4tsWadH6tc')
    expect(links).toContain('v1.1.2')
    expect(links).toContain('Grand Master V')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/seo-meta.test.ts`
Expected: FAIL, cannot resolve `../../src/shared/guide`.

- [ ] **Step 3: Write the content and brand modules**

Create `src/shared/guide.ts`:

```ts
import { LINKS } from './links'

/** When the guide's facts were last checked against the mod's README and Thunderstore page. */
export const GUIDE_CHECKED = '2026-09-23'
export const GUIDE_MOD_VERSION = '1.40.3'

export type GuideInline = string | { text: string; href: string } | { code: string } | { strong: string }
export type GuideBlock =
  | { type: 'p'; content: GuideInline[] }
  | { type: 'ul'; items: GuideInline[][] }
  | { type: 'ol'; items: GuideInline[][] }
  | { type: 'table'; head: [string, string]; rows: Array<[string, string]> }
export interface GuideSection {
  id: string
  heading: string
  blocks: GuideBlock[]
}

export const GUIDE_TITLE = 'How to play ranked ROUNDS'

export const GUIDE_INTRO: GuideInline[] = [
  { strong: "Sid's Competitive Rounds" },
  ' is the ranked mod for ROUNDS: 1v1 and 2v2 rating ladders, free-for-all, weekly tournaments, a shop and in-game betting, run for the Competitive Rounds Discord community. Here is how to install it and start playing ranked.',
]

export const GUIDE: GuideSection[] = [
  {
    id: 'before',
    heading: 'Before you install',
    blocks: [
      {
        type: 'ul',
        items: [
          ['It needs ROUNDS ', { strong: 'v1.1.2' }, ', the "Default Public Version" on Steam. Older versions and beta branches are not supported.'],
          ["It doesn't run alongside other BepInEx mods: if it finds any, it switches itself off. Keep other mods in a separate profile (see below)."],
          ['BepInEx 5.4.1901, the mod loader it needs, is installed for you.'],
        ],
      },
    ],
  },
  {
    id: 'install-r2modman',
    heading: 'Install with r2modman or Thunderstore Mod Manager',
    blocks: [
      {
        type: 'ol',
        items: [
          ['Install ', { strong: 'r2modman' }, ' or the ', { strong: 'Thunderstore Mod Manager' }, '.'],
          ['Choose ROUNDS and create a profile for ranked play.'],
          ['Search the online mods for "Sid\'s Competitive Rounds" and install it.'],
          ['Launch the game with ', { strong: 'Start modded' }, '.'],
        ],
      },
      { type: 'p', content: ['The mod\'s page: ', { text: "Sid's Competitive Rounds on Thunderstore", href: LINKS.thunderstore }, '.'] },
    ],
  },
  {
    id: 'install-windows',
    heading: 'Or use the Windows installer',
    blocks: [
      {
        type: 'ol',
        items: [
          ['Join the ', { text: 'Competitive Rounds Discord', href: LINKS.discord }, ' and download ', { code: 'CompetitiveRoundsInstaller.exe' }, '.'],
          ['Run it: it finds ROUNDS and installs BepInEx if needed.'],
          ['Launch ROUNDS. Updates install themselves.'],
        ],
      },
    ],
  },
  {
    id: 'ranked',
    heading: 'Playing ranked',
    blocks: [
      { type: 'p', content: ['Press ', { strong: 'F5' }, ' in game to open the competitive overlay and queue.'] },
      {
        type: 'ul',
        items: [
          [{ strong: '1v1' }, ': best-of-3 series on a Glicko-2 rating ladder.'],
          [{ strong: '2v2' }, ': best-of-3 series on its own Glicko-2 ladder.'],
          [{ strong: 'Free-for-all' }, ': 3 to 10 players; the first to 5 points wins.'],
          [{ strong: '1v2' }, ': one player against a duo, an unranked beta.'],
        ],
      },
      {
        type: 'p',
        content: [
          'Ratings map to 25 rank tiers, from Beginner I to Grand Master V. Your rating, record and match history appear on the ',
          { text: 'SCRmod leaderboards', href: '/leaderboards/1v1' },
          '.',
        ],
      },
    ],
  },
  {
    id: 'more',
    heading: 'Tournaments, betting, the shop and achievements',
    blocks: [
      {
        type: 'ul',
        items: [
          ['Weekly and async tournaments: sign up, vote on the start time and play from the game (F5 → Tournaments). Brackets and past winners are on the ', { text: 'tournaments page', href: '/tournaments' }, '.'],
          ["Bet gold on live ranked series; the odds come from the players' ratings."],
          ['Spend the gold you win in the in-game shop.'],
          ['Earn 50 achievements, worth 100 to 1,000 gold each.'],
        ],
      },
    ],
  },
  {
    id: 'controls',
    heading: 'Controls',
    blocks: [
      {
        type: 'table',
        head: ['Key', 'What it does'],
        rows: [
          ['F5', 'Open or close the competitive overlay'],
          ['T', 'Chat, bridged to the Discord'],
          ['Esc', 'Close the overlay'],
          ['Tab', 'Live match scoreboard'],
        ],
      },
    ],
  },
  {
    id: 'other-mods',
    heading: 'Keeping other ROUNDS mods',
    blocks: [
      {
        type: 'p',
        content: ['Because the mod switches itself off when other BepInEx mods are present, keep ranked play and your other mods in separate r2modman profiles, and launch the one you want.'],
      },
    ],
  },
  {
    id: 'links',
    heading: 'Links',
    blocks: [
      {
        type: 'ul',
        items: [
          [{ text: 'Thunderstore', href: LINKS.thunderstore }, ': install and version history.'],
          [{ text: 'GitHub', href: LINKS.github }, ': source code and the full feature list.'],
          [{ text: 'Discord', href: LINKS.discord }, ': the community, tournaments and the Windows installer.'],
          [{ text: 'ROUNDS card win rates', href: '/cards' }, ': which cards win most in ranked play.'],
        ],
      },
    ],
  },
]
```

Create `src/shared/brand.ts`. First **cut** the two-line comment (`// "SCRM" and "D" in Fredoka Bold …` and `// The crowned character …`) and the `const LEFT = …` and `const RIGHT = …` declarations from the top of `src/web/components/Wordmark.tsx`, and paste them unchanged at the top of `brand.ts` (the path strings are about 3,000 characters each: move them with cut and paste, never retype them). Below them add:

```ts
/** The SCRmod wordmark's geometry, shared by the React component and the server-rendered shell. */
export const WORDMARK = {
  viewBox: '0 -4 412.3 85.8',
  left: LEFT,
  right: RIGHT,
  face: { x: 261.4, y: -3.6, width: 82.6, height: 82.6 },
} as const

export const FOOTER_NOTE = "Data from the Sid's Competitive Rounds mod API, refreshed every few seconds. Not affiliated with Landfall."

export const NAV_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'Home' },
  { to: '/leaderboards/1v1', label: 'Boards' },
  { to: '/results', label: 'Results' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/cards', label: 'Cards' },
]
```

(The two path strings are moved verbatim with a cut and paste; do not retype them.)

Rewrite `src/web/components/Wordmark.tsx` to use it:

```tsx
import { BASE } from '../api/client'
import { WORDMARK } from '../../shared/brand'

/** The SCRmod wordmark. Height follows font-size (1em = cap-to-baseline plus the crown); color is --brand. */
export function Wordmark({ className }: { className?: string }) {
  const f = WORDMARK.face
  return (
    <svg className={`wordmark${className ? ` ${className}` : ''}`} viewBox={WORDMARK.viewBox} role="img" aria-label="SCRmod" focusable="false">
      <path d={WORDMARK.left} fill="currentColor" />
      <image href={`${BASE}/logo.webp`} x={f.x} y={f.y} width={f.width} height={f.height} />
      <path d={WORDMARK.right} fill="currentColor" />
    </svg>
  )
}
```

In `src/web/components/Layout.tsx`, replace the footer's text with `{FOOTER_NOTE}` (import from `../../shared/brand`); the links are added in Task 13.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/server/seo-meta.test.ts && npx vitest run --project web tests/web/brand.test.tsx tests/web/layout.test.tsx`
Expected: PASS (the wordmark still renders with the label "SCRmod").

- [ ] **Step 5: Commit**

```bash
git add src/shared/guide.ts src/shared/brand.ts src/web/components/Wordmark.tsx src/web/components/Layout.tsx tests/server/seo-meta.test.ts
git commit -m "Add the guide's content and share the wordmark, footer note and navigation"
```

### Task 9: The page shells

**Files:**
- Create: `src/server/seo/shell.ts`
- Test: `tests/server/seo-shell.test.ts`

**Interfaces:**
- Consumes: `esc` (Task 3), `PageMeta`, `BOARD_MODES`, `INTROS`, `cardSlug`, `PlayerFacts` (Task 2), `GUIDE*` and `WORDMARK`, `FOOTER_NOTE`, `NAV_LINKS` (Task 8), `BoardData` (Task 1), `CardPageData` (Task 5), `HomeData` and api types.
- Produces:
  ```ts
  export type ShellData =
    | { kind: 'home'; home?: HomeData }
    | { kind: 'leaderboard'; mode: string; board?: BoardData }
    | { kind: 'results'; results?: MultimodeEntry[] }
    | { kind: 'tournaments'; current?: { sync: TournamentCurrent | null; async: TournamentCurrent | null }; history?: TournamentHistoryRow[] }
    | { kind: 'tournament'; id: string }
    | { kind: 'cards'; cards?: CardStat[] }
    | { kind: 'card'; slug: string; page?: CardPageData }
    | { kind: 'guide' }
    | { kind: 'about' }
    | { kind: 'player'; id: string; player?: PlayerFacts }
    | { kind: 'not-found' }
  export function renderShell(data: ShellData, base: string): string
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { renderShell } from '../../src/server/seo/shell'

const entry = (rank: number, name: string, rating: number) => ({ rank, steam_id: `7656119900000000${rank}`, display_name: name, rating })

describe('renderShell', () => {
  it('always carries the navigation as plain links, under the base path', () => {
    const html = renderShell({ kind: 'about' }, '/hub')
    expect(html).toContain('<a class="item" href="/hub/leaderboards/1v1">Boards</a>')
    expect(html).toContain('<a href="/hub/guide">Guide</a>')
    expect(html).toContain('<footer class="footer">')
    expect(html).toContain('aria-label="SCRmod"')
  })

  it('lists the top 25 of a board, escaped', () => {
    const board = { entries: [entry(1, 'Sid', 2564), entry(2, '</a><script>x</script>', 2352), ...Array.from({ length: 30 }, (_, i) => entry(i + 3, `P${i}`, 1500))], total_players: 32 }
    const html = renderShell({ kind: 'leaderboard', mode: '1v1', board: board as never }, '')
    expect(html).toContain('<h1>Leaderboards</h1>')
    expect(html).toContain("Ranked ROUNDS players in Sid&#39;s Competitive Rounds, ordered by rating.")
    expect(html).toContain('href="/players/76561199000000001">Sid</a> · 2564')
    expect(html).not.toContain('<script>x')
    expect(html.match(/<li class="row list-row">/g)).toHaveLength(25)
  })

  it('links every card, and renders a card page with its stats and neighbours', () => {
    const cards = [{ card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 1234, win_rate: 0.523, pass_rate: 0.31 }]
    expect(renderShell({ kind: 'cards', cards: cards as never }, '')).toContain('<a href="/cards/big-bullet">Big Bullet</a>')
    const page = { slug: 'big-bullet', card: { ...cards[0], times_offered: 2000, unique_players: 70, sweeps_with_card: 9 }, ranked: null, casual: null, winners: [{ card: 'Big Bullet', player: 'Stan', count: 50 }], sweepers: [], prev: { name: 'Poison', slug: 'poison' }, next: null }
    const html = renderShell({ kind: 'card', slug: 'big-bullet', page: page as never }, '')
    expect(html).toContain('<h1>Big Bullet</h1>')
    expect(html).toContain('52% win rate')
    expect(html).toContain('Stan · 50')
    expect(html).toContain('<a href="/cards/poison">← Poison</a>')
  })

  it('renders the whole guide', () => {
    const html = renderShell({ kind: 'guide' }, '')
    expect(html).toContain('<h1>How to play ranked ROUNDS</h1>')
    expect(html).toContain('<h2>Install with r2modman or Thunderstore Mod Manager</h2>')
    expect(html).toContain('<code>CompetitiveRoundsInstaller.exe</code>')
    expect(html).toContain('<td>F5</td>')
    expect(html).toContain('href="/leaderboards/1v1"')
  })

  it('falls back to headings and links when the data did not arrive', () => {
    for (const d of [{ kind: 'home' }, { kind: 'leaderboard', mode: '2v2' }, { kind: 'results' }, { kind: 'tournaments' }, { kind: 'cards' }, { kind: 'card', slug: 'big-bullet' }, { kind: 'player', id: '76561199311926326' }, { kind: 'tournament', id: 'x' }, { kind: 'not-found' }] as const) {
      const html = renderShell(d, '')
      expect(html).toContain('<h1>')
      expect(html).toContain('<main class="page" id="main">')
    }
    expect(renderShell({ kind: 'not-found' }, '')).toContain('<h1>Nothing here</h1>')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/seo-shell.test.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

```ts
import type { CardStat, MultimodeEntry, TournamentCurrent, TournamentHistoryRow } from '../../shared/api-types'
import { FOOTER_NOTE, NAV_LINKS, WORDMARK } from '../../shared/brand'
import { GUIDE, GUIDE_INTRO, GUIDE_TITLE, type GuideBlock, type GuideInline } from '../../shared/guide'
import type { CardPageData, HomeData } from '../../shared/hub-types'
import { LINKS } from '../../shared/links'
import { BOARD_MODES, INTROS, cardSlug, slugToName, type PlayerFacts } from '../../shared/seo'
import type { BoardData } from '../routes/boards'
import { esc } from './html'

export type ShellData =
  | { kind: 'home'; home?: HomeData }
  | { kind: 'leaderboard'; mode: string; board?: BoardData }
  | { kind: 'results'; results?: MultimodeEntry[] }
  | { kind: 'tournaments'; current?: { sync: TournamentCurrent | null; async: TournamentCurrent | null }; history?: TournamentHistoryRow[] }
  | { kind: 'tournament'; id: string }
  | { kind: 'cards'; cards?: CardStat[] }
  | { kind: 'card'; slug: string; page?: CardPageData }
  | { kind: 'guide' }
  | { kind: 'about' }
  | { kind: 'player'; id: string; player?: PlayerFacts }
  | { kind: 'not-found' }

const pct = (f: number | null | undefined) => (f === null || f === undefined || !Number.isFinite(f) ? '–' : `${Math.round(f * 100)}%`)
const num = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toLocaleString('en-US'))
/** The upstream calls 1v2 "ovt"; the app shows 1v2. */
const MODE_LABEL: Record<string, string> = { '1v1': '1v1', '2v2': '2v2', ffa: 'FFA', ovt: '1v2', '1v2': '1v2' }
const resultLine = (e: MultimodeEntry) => `${esc(MODE_LABEL[e.mode] ?? e.mode)} · ${esc(e.left_label)} ${esc(e.score)} ${esc(e.right_label)}`

/** A crawlable, lightweight version of each page in the site's own markup; React replaces it on load. */
export function renderShell(data: ShellData, base: string): string {
  const a = (path: string, text: string, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(base + path)}">${esc(text)}</a>`
  const ext = (href: string, text: string) => `<a href="${esc(href)}" rel="noopener">${esc(text)}</a>`
  const inline = (parts: GuideInline[]) =>
    parts
      .map((p) =>
        typeof p === 'string' ? esc(p) : 'href' in p ? (p.href.startsWith('/') ? a(p.href, p.text) : ext(p.href, p.text)) : 'code' in p ? `<code>${esc(p.code)}</code>` : `<strong>${esc(p.strong)}</strong>`,
      )
      .join('')
  const block = (b: GuideBlock) => {
    if (b.type === 'p') return `<p>${inline(b.content)}</p>`
    if (b.type === 'table')
      return `<table class="t"><thead><tr><th>${esc(b.head[0])}</th><th>${esc(b.head[1])}</th></tr></thead><tbody>${b.rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`
    const tag = b.type
    return `<${tag} class="prose">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`
  }
  const list = (items: string[]) => (items.length ? `<ul class="plain-list">${items.map((i) => `<li class="row list-row">${i}</li>`).join('')}</ul>` : '')
  const card = (heading: string, inner: string) => `<section class="card"><h2>${esc(heading)}</h2>${inner}</section>`
  const intro = (text: string) => `<p class="page-intro">${esc(text)}</p>`

  let main: string
  switch (data.kind) {
    case 'home': {
      const h = data.home
      const live = h ? [...h.live.series_1v1.map((s) => `${esc(s.p1_name)} ${s.p1_wins}–${s.p2_wins} ${esc(s.p2_name)}`)] : []
      const results = (h?.results ?? []).slice(0, 8).map(resultLine)
      main =
        `<h1>Right now</h1><p class="page-intro">${a('/guide', 'New to ranked ROUNDS? Start here →')}</p>` +
        (h ? `<ul class="plain-list"><li>Online now: ${num(h.presence.online_count)}</li><li>Ranked queue: ${num(h.queue.ranked_searching)} searching</li><li>Live games: ${num(h.live.series_1v1.length + h.live.series_2v2.length + h.live.ffa_lobbies.length)}</li></ul>` : '') +
        card('Live games', list(live) || '<p>No live games right now.</p>') +
        card('Latest results', list(results) + `<p>${a('/results', 'All results →')}</p>`)
      break
    }
    case 'leaderboard': {
      const mode = BOARD_MODES.find((m) => m.id === data.mode)
      const rows = (data.board?.entries ?? []).slice(0, 25).map((e) => {
        const rating = 'rating' in e && typeof e.rating === 'number' ? ` · ${Math.round(e.rating)}` : ''
        return `#${e.rank} ${a(`/players/${e.steam_id}`, e.display_name || 'Unnamed player')}${rating}`
      })
      main =
        `<h1>Leaderboards</h1>${intro(mode?.ranked === false ? INTROS.leaderboards1v2 : INTROS.leaderboards)}` +
        `<nav class="tabs" aria-label="Leaderboard mode">${BOARD_MODES.map((m) => a(`/leaderboards/${m.id}`, m.label)).join('')}</nav>` +
        `<section class="card">${list(rows)}</section>`
      break
    }
    case 'results':
      main = `<h1>Results</h1>${intro(INTROS.results)}<section class="card">${list((data.results ?? []).slice(0, 20).map(resultLine))}</section>`
      break
    case 'tournaments': {
      const status = (label: string, t: TournamentCurrent | null | undefined) => (t?.tournament_id ? `${esc(label)}: ${esc(t.status ?? '')} · ${num(t.signups?.length ?? 0)} signups` : `${esc(label)}: nothing scheduled`)
      const past = (data.history ?? []).slice(0, 10).map((r) => `${esc(r.kind)} · winner ${esc(r.winner_display_name ?? '–')} · ${esc((r.ended_at ?? '').slice(0, 10))}`)
      main =
        `<h1>Tournaments</h1>${intro(INTROS.tournaments)}` +
        (data.current ? `<ul class="plain-list"><li>${status('Weekly sync tournament', data.current.sync)}</li><li>${status('Async tournament', data.current.async)}</li></ul>` : '') +
        card('Past tournaments', list(past))
      break
    }
    case 'tournament':
      main = `<h1>Tournaments</h1><section class="card"><h2>Game details</h2><p>${a('/tournaments', '← tournaments')}</p></section>`
      break
    case 'cards':
      main = `<h1>Cards</h1>${intro(INTROS.cards)}<section class="card">${list((data.cards ?? []).map((c) => `${a(`/cards/${cardSlug(c.card_name)}`, c.card_name)} · ${pct(c.win_rate)} win rate · ${num(c.times_picked)} picks`))}</section>`
      break
    case 'card': {
      const p = data.page
      if (!p) {
        main = `<h1>${esc(slugToName(data.slug))}</h1><p>${a('/cards', '← All cards')}</p>`
        break
      }
      const c = p.card
      const stats = [`${pct(c.win_rate)} win rate`, `${num(c.times_picked)} picks`, `${num(c.times_offered)} times offered`, `${pct(c.pass_rate)} pass rate`, `${num(c.unique_players)} players`, `${num(c.sweeps_with_card)} 5-0 sweeps`]
      if (p.ranked) stats.push(`${pct(p.ranked.win_rate)} win rate in ranked games`)
      main =
        `<h1>${esc(c.card_name)}</h1><p class="page-intro">${esc(c.card_rarity)} card</p>` +
        `<section class="card">${list(stats.map(esc))}</section>` +
        (p.winners.length ? card('Most wins with it', list(p.winners.slice(0, 10).map((w) => `${esc(w.player)} · ${num(w.count)}`))) : '') +
        `<p>${p.prev ? a(`/cards/${p.prev.slug}`, `← ${p.prev.name}`) : ''} ${a('/cards', 'All cards')} ${p.next ? a(`/cards/${p.next.slug}`, `${p.next.name} →`) : ''}</p>`
      break
    }
    case 'guide':
      main = `<h1>${esc(GUIDE_TITLE)}</h1><p class="page-intro">${inline(GUIDE_INTRO)}</p>${GUIDE.map((s) => `<section class="card" id="${esc(s.id)}"><h2>${esc(s.heading)}</h2>${s.blocks.map(block).join('')}</section>`).join('')}`
      break
    case 'about':
      // Word for word from About.tsx (its first sentence and the guide link Task 14 adds), since the shell may only show what the app shows.
      main = `<h1>About SCRmod</h1><section class="card"><h2>What this is</h2><p>A browser companion for <strong>Sid&#39;s Competitive Rounds</strong>, the ranked mod for ROUNDS.</p><p>New to it? ${a('/guide', 'How to install the mod and play ranked')}.</p></section>`
      break
    case 'player': {
      const p = data.player
      main = `<h1 class="player-name">${esc(p?.display_name || 'Player')}</h1>` + (p ? `<p>${[p.rank_name, p.rating != null ? `${Math.round(p.rating)} rating` : null].filter(Boolean).map(esc).join(' · ')}</p>` : '') + `<p>${a('/leaderboards/1v1', 'Leaderboards')}</p>`
      break
    }
    case 'not-found':
      main = `<section class="card"><h1>Nothing here</h1><p>That page doesn't exist.</p><p>${a('/', 'Back home')}</p></section>`
      break
  }

  const f = WORDMARK.face
  const wordmark = `<svg class="wordmark" viewBox="${WORDMARK.viewBox}" role="img" aria-label="SCRmod"><path d="${WORDMARK.left}" fill="currentColor"/><image href="${esc(base)}/logo.webp" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}"/><path d="${WORDMARK.right}" fill="currentColor"/></svg>`
  return (
    `<header class="topbar"><a class="brand" href="${esc(base)}/" aria-label="SCRmod home">${wordmark}</a>` +
    `<nav class="topnav" aria-label="Primary">${NAV_LINKS.map((n) => a(n.to, n.label, 'item')).join('')}</nav></header>` +
    `<main class="page" id="main">${main}</main>` +
    `<footer class="footer">${esc(FOOTER_NOTE)} ${a('/about', 'About & privacy')} · ${a('/guide', 'Guide')} · Watch on ${ext(LINKS.twitch, 'Twitch')} · ${ext(LINKS.youtube, 'YouTube')}</footer>`
  )
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/server/seo-shell.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/seo/shell.ts tests/server/seo-shell.test.ts
git commit -m "Render a crawlable shell for every page"
```

### Task 10: Resolve and serve pages from the SPA fallback

**Files:**
- Create: `src/server/seo/page.ts`
- Modify: `src/server/static.ts`, `src/server/node.ts`
- Test: `tests/server/seo-pages.test.ts`

**Interfaces:**
- Consumes: loaders (Task 1), `matchRoute`, `pageMeta`, `cardSlug` (Task 2), `fillTemplate` (Task 3), JSON-LD (Task 4), `loadCardPage` (Task 5), `siteUrl`, `basePrefix` (Task 6), `renderHead` (Task 7), `renderShell` (Task 9), `GUIDE_CHECKED`, `GUIDE_TITLE` (Task 8).
- Produces: `SHELL_DATA_MS = 250`, `resolvePage(d: RouteDeps, path: string, requestUrl: string): Promise<{ redirect: string } | { status: 200 | 404; head: string; body: string; index: boolean }>`; `registerStatic(app, { root, basePath, deps?: RouteDeps })`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliDecompressSync } from 'node:zlib'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'
import { registerStatic } from '../../src/server/static'
import type { RouteMap } from './helpers/fakeUpstream'

const ID = '76561199311926326'
let root: string
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scr-seo-'))
  await writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8" /><!--seo:head:start--><title>SCRmod</title><!--seo:head:end--></head><body><div id="root"><!--seo:body--></div></body></html>',
  )
})

// Requests go to the canonical host, so Task 12's host redirect leaves these tests alone.
const ORIGIN = 'https://scrmod.com'
function site(map: RouteMap) {
  const built = makeApp(map, { PUBLIC_BASE_URL: ORIGIN })
  registerStatic(built.app, { root, basePath: built.env.basePath, deps: built.deps })
  return { request: (p: string, init?: RequestInit) => built.app.request(`${ORIGIN}${p}`, init) }
}

const board = { entries: [{ rank: 1, steam_id: ID, display_name: 'Sid</title>', rating: 2564 }], total_players: 1 }
const cards = [{ card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 800, win_rate: 0.52, pass_rate: 0.31, times_offered: 1500, unique_players: 70, sweeps_with_card: 9 }]

describe('server-rendered pages', () => {
  it('home: head, structured data and shell', async () => {
    const res = await site({ '/presence/online': { online_count: 7, online: [], recent: [] } }).request('/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<title>SCRmod: ROUNDS ranked stats, live games and leaderboards</title>')
    expect(html).toContain('<link rel="canonical" href="https://scrmod.com/" />')
    expect(html).toContain('"@type":"WebSite"')
    expect(html).toContain('Online now: 7')
    expect(html).not.toContain('<!--seo:')
  })

  it('a board lists its players with names escaped', async () => {
    const html = await (await site({ '/leaderboard': board }).request('/leaderboards/1v1')).text()
    expect(html).toContain('ROUNDS 1v1 ranked leaderboard: top players by rating · SCRmod')
    expect(html).toContain('Sid&lt;/title&gt;')
    expect(html).not.toContain('Sid</title>')
  })

  it('redirects /leaderboards and card aliases, 404s the unknown', async () => {
    const app = site({ '/cards': cards })
    const r1 = await app.request('/leaderboards')
    expect(r1.status).toBe(301)
    expect(r1.headers.get('location')).toBe('/leaderboards/1v1')
    const r2 = await app.request('/cards/Big%20Bullet')
    expect(r2.status).toBe(301)
    expect(r2.headers.get('location')).toBe('/cards/big-bullet')
    expect((await app.request('/cards/nope')).status).toBe(404)
    const nf = await app.request('/wp-login.php')
    expect(nf.status).toBe(404)
    expect(await nf.text()).toContain('<meta name="robots" content="noindex, follow" />')
    expect((await app.request('/players/123')).status).toBe(404)
  })

  it('a card page carries its facts in the description and the shell', async () => {
    const res = await site({ '/cards': cards }).request('/cards/big-bullet')
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('Big Bullet (Common) in ROUNDS: 52% win rate')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toContain('<h1>Big Bullet</h1>')
  })

  it('a profile stays out of the index but gets a rich preview; a deleted one 404s', async () => {
    const app = site({ [`/players/${ID}`]: { steam_id: ID, display_name: 'NotNic', rating: 1101.8, rank_name: 'Beginner I' } })
    const res = await app.request(`/players/${ID}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBe('noindex, follow')
    expect(await res.text()).toContain('<meta property="og:description" content="1102 rating · Beginner I" />')
    const gone = site({ [`/players/${ID}`]: () => json({ detail: 'not found' }, 404) })
    expect((await gone.request(`/players/${ID}`)).status).toBe(404)
  })

  it('does not wait more than the cap on a slow upstream', async () => {
    const slow = () => new Promise<Response>((r) => setTimeout(() => r(json(board)), 2000))
    const t0 = Date.now()
    const res = await site({ '/leaderboard': slow }).request('/leaderboards/1v1')
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<h1>Leaderboards</h1>')
  })

  it('works under a base path and compresses', async () => {
    const built = makeApp({}, { BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' })
    registerStatic(built.app, { root, basePath: '/hub', deps: built.deps })
    const html = await (await built.app.request('https://example.org/hub/guide')).text()
    expect(html).toContain('<link rel="canonical" href="https://example.org/hub/guide" />')
    expect(html).toContain('href="/hub/leaderboards/1v1"')
    const br = await built.app.request('https://example.org/hub/guide', { headers: { 'Accept-Encoding': 'br' } })
    expect(br.headers.get('content-encoding')).toBe('br')
    expect(brotliDecompressSync(Buffer.from(await br.arrayBuffer())).toString()).toContain('How to play ranked ROUNDS')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/seo-pages.test.ts`
Expected: FAIL (`registerStatic` ignores `deps`; the title is the template's plain "SCRmod").

- [ ] **Step 3: Implement `page.ts`**

```ts
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

export type PageResult = { redirect: string } | { status: 200 | 404; head: string; body: string; index: boolean }

export async function resolvePage(d: RouteDeps, path: string, requestUrl: string): Promise<PageResult> {
  const base = basePrefix(d.env)
  const site = siteUrl(d.env, requestUrl)
  let match = matchRoute(path)
  if (match.kind === 'leaderboards-root') return { redirect: `${base}/leaderboards/1v1` }

  let shell: ShellData = { kind: 'not-found' }
  const facts: MetaFacts = {}
  const jsonLd: object[] = [siteGraph(site)]

  switch (match.kind) {
    case 'home': {
      const r = await settle(loadHome(d))
      shell = { kind: 'home', home: r.ok ? scrubPrivate(r.value.data) : undefined }
      break
    }
    case 'leaderboard': {
      const r = await settle(loadBoard(d, match.mode))
      shell = { kind: 'leaderboard', mode: match.mode, board: r.ok && r.value ? scrubPrivate(r.value.value) : undefined }
      break
    }
    case 'results': {
      const r = await settle(loadResults(d, 100))
      shell = { kind: 'results', results: r.ok ? scrubPrivate(r.value.value.entries ?? []) : undefined }
      break
    }
    case 'tournaments': {
      const r = await settle(Promise.all([loadTournaments(d), loadTournamentHistory(d)]))
      shell = r.ok ? { kind: 'tournaments', current: scrubPrivate(r.value[0].data), history: scrubPrivate(r.value[1].data.rows) } : { kind: 'tournaments' }
      break
    }
    case 'tournament': {
      const r = await settle(loadBracket(d, match.id))
      if (!r.ok && r.notFound) match = { kind: 'not-found' }
      else shell = { kind: 'tournament', id: match.id }
      break
    }
    case 'cards': {
      const r = await settle(loadCards(d, 'all'))
      const cards = r.ok ? r.value.value : undefined
      shell = { kind: 'cards', cards }
      if (cards) {
        facts.cardCount = cards.length
        jsonLd.push(itemList(site, cards.map((c) => ({ name: c.card_name, path: `/cards/${cardSlug(c.card_name)}` }))))
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
      const page = r.ok && r.value.kind === 'found' ? r.value.result.value : undefined
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
      const r = await settle(loadProfile(d, match.id))
      if (!r.ok && r.notFound) {
        match = { kind: 'not-found' }
        break
      }
      const p = r.ok ? (r.value.value as Record<string, unknown>) : undefined
      const player: PlayerFacts | undefined = p
        ? {
            display_name: String(p.display_name ?? ''),
            rating: typeof p.rating === 'number' ? p.rating : null,
            rank_name: typeof p.rank_name === 'string' ? p.rank_name : null,
            standing: typeof p.standing === 'number' ? p.standing : null,
            standing_population: typeof p.standing_population === 'number' ? p.standing_population : null,
            ranked_series_wins: typeof p.ranked_series_wins === 'number' ? p.ranked_series_wins : null,
            ranked_series_losses: typeof p.ranked_series_losses === 'number' ? p.ranked_series_losses : null,
          }
        : undefined
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
```

- [ ] **Step 4: Wire it into `static.ts` and `node.ts`**

In `src/server/static.ts`:
- import `{ brotliCompress, constants as zlib, gzip }` is already there; add `import type { RouteDeps } from './routes/common'`, `import { resolvePage } from './seo/page'`, `import { fillTemplate } from './seo/html'`.
- change the signature to `export function registerStatic(app: Hono, opts: { root: string; basePath: string; deps?: RouteDeps })`.
- replace the SPA fallback `try { … } catch { return c.html(PLACEHOLDER) }` block at the end of the handler with:

```ts
    let template: string
    try {
      template = await readFile(path.join(root, 'index.html'), 'utf8')
    } catch {
      return c.html(PLACEHOLDER)
    }
    c.header('Cache-Control', 'no-cache')
    c.header('Content-Type', TYPES['.html'])
    c.header('Vary', 'Accept-Encoding')
    let status: 200 | 404 = 200
    let html = template
    if (opts.deps) {
      const page = await resolvePage(opts.deps, p, c.req.url)
      if ('redirect' in page) return c.redirect(page.redirect, 301)
      status = page.status
      if (!page.index) c.header('X-Robots-Tag', 'noindex, follow')
      html = fillTemplate(template, page.head, page.body)
    }
    let body: Bytes = new TextEncoder().encode(html) as Bytes
    const enc = body.length >= MIN_COMPRESS ? pickEncoding(c.req.header('Accept-Encoding')) : null
    if (enc) {
      // Every page is different now, so compress per request at fast settings (brotli 5 / gzip 6).
      body = (await (enc === 'br' ? brotli(body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 5 } }) : gz(body, { level: 6 }))) as Bytes
      c.header('Content-Encoding', enc)
    }
    return c.body(body, status)
```

(`p` is the handler's existing path variable with the base path already stripped. The fallback no longer uses `stat` on `index.html`, so delete the `import type { Stats } from 'node:fs'` line; `stat` itself is still used for files. Without `deps`, as in `tests/server/static.test.ts`, the template is served unchanged, so that suite keeps passing, traversal cases included.)

In `src/server/node.ts`: `const { app, version, deps } = createApp({ env, fetchImpl, store: new MemoryCacheStore() })` and `registerStatic(app, { root: env.webRoot, basePath: env.basePath, deps })`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/server/seo-pages.test.ts tests/server/static.test.ts && npm run typecheck`
Expected: PASS. `static.test.ts` still passes because it registers without `deps`.

- [ ] **Step 6: Commit**

```bash
git add src/server/seo/page.ts src/server/static.ts src/server/node.ts tests/server/seo-pages.test.ts
git commit -m "Serve every page with its own head, shell, status and redirects"
```

### Task 11: `robots.txt` and `sitemap.xml`

**Files:**
- Create: `src/server/seo/crawl.ts`
- Modify: `src/server/app.ts`
- Test: `tests/server/crawl.test.ts`

**Interfaces:**
- Consumes: `loadCards` (Task 1), `BOARD_MODES`, `cardSlug` (Task 2), `GUIDE_CHECKED` (Task 8), `siteUrl`, `basePrefix` (Task 6).
- Produces: `registerCrawlRoutes(app: Hono, d: RouteDeps)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const cards = [{ card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 1, win_rate: 0.5, pass_rate: 0.3 }]

describe('crawl files', () => {
  it('robots.txt allows pages, blocks the API and points to the sitemap', async () => {
    const { app } = makeApp({}, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('/robots.txt')
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toBe('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: https://scrmod.com/sitemap.xml\n')
  })

  it('the sitemap lists the pages and every card, never players', async () => {
    const { app } = makeApp({ '/cards': cards }, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('/sitemap.xml')
    expect(res.headers.get('content-type')).toContain('application/xml')
    const xml = await res.text()
    for (const p of ['/', '/leaderboards/1v1', '/leaderboards/1v2-duo', '/results', '/tournaments', '/cards', '/guide', '/about', '/cards/big-bullet']) {
      expect(xml).toContain(`<loc>https://scrmod.com${p}</loc>`)
    }
    expect(xml).toMatch(/<loc>https:\/\/scrmod\.com\/cards\/big-bullet<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)
    expect(xml).toContain('<loc>https://scrmod.com/guide</loc><lastmod>2026-09-23</lastmod>')
    expect(xml).not.toContain('/players/')
    expect(xml.match(/<url>/g)).toHaveLength(13) // 12 site pages (home, 6 boards, results, tournaments, cards, guide, about) + 1 card
  })

  it('still serves the pages when the card list fails', async () => {
    const { app } = makeApp({ '/cards': () => json({ detail: 'down' }, 500) }, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('/sitemap.xml')
    expect(res.status).toBe(200)
    expect((await res.text()).match(/<url>/g)).toHaveLength(12)
  })

  it('respects a base path', async () => {
    const { app } = makeApp({}, { BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' })
    expect(await (await app.request('/hub/robots.txt')).text()).toContain('Disallow: /hub/api/\nDisallow: /hub/auth/\n\nSitemap: https://example.org/hub/sitemap.xml')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/crawl.test.ts`
Expected: FAIL (404s).

- [ ] **Step 3: Implement**

```ts
import type { Hono } from 'hono'
import { GUIDE_CHECKED } from '../../shared/guide'
import { BOARD_MODES, cardSlug } from '../../shared/seo'
import { loadCards } from '../routes/cards'
import type { RouteDeps } from '../routes/common'
import { esc } from './html'
import { basePrefix, siteUrl } from './site'

export function registerCrawlRoutes(app: Hono, d: RouteDeps) {
  app.get('/robots.txt', (c) => {
    const base = basePrefix(d.env)
    c.header('Content-Type', 'text/plain; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(`User-agent: *\nAllow: /\nDisallow: ${base}/api/\nDisallow: ${base}/auth/\n\nSitemap: ${siteUrl(d.env, c.req.url)}/sitemap.xml\n`)
  })

  app.get('/sitemap.xml', async (c) => {
    const site = siteUrl(d.env, c.req.url)
    const urls: Array<{ path: string; lastmod?: string }> = [
      { path: '/' },
      ...BOARD_MODES.map((m) => ({ path: `/leaderboards/${m.id}` })),
      { path: '/results' },
      { path: '/tournaments' },
      { path: '/cards' },
      { path: '/guide', lastmod: GUIDE_CHECKED },
      { path: '/about' },
    ]
    try {
      const cards = await loadCards(d, 'all')
      const day = new Date(cards.fetched_at).toISOString().slice(0, 10)
      for (const card of cards.value) urls.push({ path: `/cards/${cardSlug(card.card_name)}`, lastmod: day })
    } catch {
      // No card list right now: the sitemap still lists the site's own pages.
    }
    const body = urls
      .map((u) => `  <url><loc>${esc(u.path === '/' ? `${site}/` : `${site}${u.path}`)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n')
    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`)
  })
}
```

In `src/server/app.ts`, import it and call `registerCrawlRoutes(app, routeDeps)` after the other route registrations.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/server/crawl.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/seo/crawl.ts src/server/app.ts tests/server/crawl.test.ts
git commit -m "Serve robots.txt and a live sitemap"
```

### Task 12: One canonical host

**Files:**
- Create: `src/server/seo/host.ts`
- Modify: `src/server/app.ts`
- Test: `tests/server/host.test.ts`

**Interfaces:**
- Produces: `canonicalHost(env: Env): MiddlewareHandler`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'

describe('canonical host', () => {
  it('redirects page requests on another host to the public one, keeping path and query', async () => {
    const { app } = makeApp({}, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('http://scr-hub.up.railway.app/leaderboards/1v1?x=1')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://scrmod.com/leaderboards/1v1?x=1')
    expect((await app.request('http://www.scrmod.com/')).headers.get('location')).toBe('https://scrmod.com/')
  })

  it('leaves the API, auth, files, other methods and the right host alone', async () => {
    const { app } = makeApp({}, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    expect((await app.request('http://scr-hub.up.railway.app/api/_status')).status).not.toBe(301)
    expect((await app.request('http://scr-hub.up.railway.app/auth/me')).status).not.toBe(301)
    expect((await app.request('http://scr-hub.up.railway.app/robots.txt')).status).not.toBe(301)
    expect((await app.request('http://scr-hub.up.railway.app/x', { method: 'POST' })).status).not.toBe(301)
    expect((await app.request('https://scrmod.com/robots.txt')).status).toBe(200)
  })

  it('does nothing without PUBLIC_BASE_URL', async () => {
    const { app } = makeApp({})
    expect((await app.request('http://anything.test/robots.txt')).status).toBe(200)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/host.test.ts`
Expected: FAIL (no 301).

- [ ] **Step 3: Implement**

```ts
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../env'

/**
 * One address per page for search engines: a page request that reached the site through another host (the
 * Railway address, www.) is sent to the same path on PUBLIC_BASE_URL. The API, auth and files are never moved,
 * so health checks and API clients keep working on any host.
 */
export function canonicalHost(env: Env): MiddlewareHandler {
  const target = env.publicBaseUrl ? new URL(env.publicBaseUrl) : null
  return async (c, next) => {
    if (!target || (c.req.method !== 'GET' && c.req.method !== 'HEAD')) return next()
    const url = new URL(c.req.url)
    if (url.host === target.host) return next()
    const rel = env.basePath === '/' ? url.pathname : url.pathname.slice(env.basePath.length) || '/'
    if (rel.startsWith('/api/') || rel.startsWith('/auth/') || /\.[a-z0-9]+$/i.test(rel)) return next()
    return c.redirect(`${target.origin}${url.pathname}${url.search}`, 301)
  }
}
```

In `src/server/app.ts`, import it and add `app.use('*', canonicalHost(env))` before the rate limiter.

- [ ] **Step 4: Run the test and the server suite**

Run: `npx vitest run tests/server/host.test.ts && npx vitest run --project server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/seo/host.ts src/server/app.ts tests/server/host.test.ts
git commit -m "Redirect page requests on other hosts to the canonical one"
```

---

## Phase C: web pages

### Task 13: Titles from the shared metadata, intro lines, footer links, template markers

**Files:**
- Modify: `src/web/index.html`, `src/web/lib/title.ts`, `src/web/components/Layout.tsx`, `src/web/pages/{Home,Leaderboards,Results,Tournaments,Cards,About,NotFound,Player}.tsx`, `src/web/styles/base.css`
- Test: `tests/web/seo-titles.test.tsx`

**Interfaces:**
- Consumes: `pageMeta`, `INTROS`, `BOARD_MODES` (Task 2), `LINKS`.
- Produces: `useTitle(title: string)` now sets the full title verbatim.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { boards, cards } from './helpers/fixtures'
import { Leaderboards } from '../../src/web/pages/Leaderboards'
import { Cards } from '../../src/web/pages/Cards'
import { Layout } from '../../src/web/components/Layout'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('page titles and intros', () => {
  it('leaderboards: the planned title and intro, per mode', async () => {
    mockHub({ '/leaderboard/2v2': env(boards['2v2']), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/2v2', path: '/leaderboards/:mode' })
    await waitFor(() => expect(document.title).toBe('ROUNDS 2v2 ranked leaderboard: top players by rating · SCRmod'))
    expect(screen.getByText("Ranked ROUNDS players in Sid's Competitive Rounds, ordered by rating.")).toBeInTheDocument()
  })

  it('cards: title and intro', async () => {
    mockHub({ '/cards?filter=all&sort=times_picked&order=desc': env(cards), '/cards/leaders': env({ sweepers: [], winners: [] }), '/me': SIGNED_OUT })
    renderApp(<Cards />)
    await waitFor(() => expect(document.title).toBe('ROUNDS card win rates: the best cards in ranked play · SCRmod'))
    expect(screen.getByText('Win, pick and pass rates for every ROUNDS card across ranked and casual games.')).toBeInTheDocument()
  })

  it('the footer links the guide and the stream channels', () => {
    mockHub({ '/me': SIGNED_OUT })
    renderApp(
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>x</p>} />
        </Route>
      </Routes>,
    )
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/guide')
    expect(screen.getByRole('link', { name: 'Twitch' })).toHaveAttribute('href', 'https://www.twitch.tv/sidscompetitiverounds')
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@SidsCompetitiveRounds')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/web/seo-titles.test.tsx`
Expected: FAIL (title is "2v2 leaderboard · SCRmod"; intro and footer links missing).

- [ ] **Step 3: Implement**

`src/web/lib/title.ts`:

```ts
import { useEffect } from 'react'

/** Sets the document title (built by pageMeta, so it matches the server-rendered one). */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
```

Page calls (add `import { pageMeta } from '../../shared/seo'` or the right relative path):
- Home: `useTitle(pageMeta({ kind: 'home' }).title)`
- Leaderboards: `useTitle(pageMeta({ kind: 'leaderboard', mode }).title)`
- Results: `useTitle(pageMeta({ kind: 'results' }).title)`
- Tournaments: `useTitle(pageMeta({ kind: 'tournaments' }).title)`
- Cards: `useTitle(pageMeta({ kind: 'cards' }).title)`
- About: `useTitle(pageMeta({ kind: 'about' }).title)`
- NotFound: `useTitle(pageMeta({ kind: 'not-found' }).title)`
- Player: `useTitle(valid ? pageMeta({ kind: 'player', id: steamId! }, { player: q.data ? { display_name: q.data.data.display_name } : undefined }).title : pageMeta({ kind: 'not-found' }).title)`

Intro lines (right after each page's `<h1>`, before anything else):
- Leaderboards (`<h1>Leaderboards</h1>`, before the mode `<nav>`): `<p className="page-intro">{BOARD_MODES.find((m) => m.id === mode)?.ranked === false ? INTROS.leaderboards1v2 : INTROS.leaderboards}</p>`. Also delete the page's local `MODES` array and use `BOARD_MODES` from `../../shared/seo` in its place (same ids and labels, in the same order); the `useTitle` line no longer needs it.
- Results (before `<Tabs>`): `<p className="page-intro">{INTROS.results}</p>`
- Tournaments: replace `<p className="muted">Sign up, vote and play from the game (F5 → Tournaments). This page is the live view.</p>` with `<p className="page-intro">{INTROS.tournaments} Sign up, vote and play from the game (F5 → Tournaments).</p>`
- Cards (before the toolbar): `<p className="page-intro">{INTROS.cards}</p>`
- Home (before `<QueryState>`): `<p className="page-intro"><Link to="/guide">New to ranked ROUNDS? Start here →</Link></p>` (Home already imports `Link`).

Footer in `Layout.tsx`:

```tsx
      <footer className="footer">
        {FOOTER_NOTE} <NavLink to="/about">About &amp; privacy</NavLink> · <NavLink to="/guide">Guide</NavLink> · Watch on{' '}
        <a href={LINKS.twitch} rel="noopener">
          Twitch
        </a>{' '}
        ·{' '}
        <a href={LINKS.youtube} rel="noopener">
          YouTube
        </a>
      </footer>
```

`src/web/styles/base.css` (append):

```css
/* The one line under a page heading that says what the page is. */
.page-intro {
  margin: calc(-1 * var(--space-xs)) 0 var(--space-md);
  color: var(--fg-muted);
}
```

`src/web/index.html`, three edits:

1. Wrap the six tags from `<title>SCRmod</title>` through `<meta name="twitter:card" …>` (they sit just before `</head>`, after both scripts) so the block reads:

```html
    <!--seo:head:start-->
    <title>SCRmod</title>
    <meta name="description" content="Sid's Competitive Rounds from your browser: who is online, live games, leaderboards and stats." />
    <meta property="og:site_name" content="SCRmod" />
    <meta property="og:title" content="SCRmod · scrmod.com" />
    <meta property="og:description" content="Sid's Competitive Rounds from your browser: who is online, live games, leaderboards and stats." />
    <meta property="og:image" content="https://scrmod.com/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <!--seo:head:end-->
```

2. `<div id="root"></div>` becomes `<div id="root"><!--seo:body--></div>`.

3. In the early-fetch script, replace the end of the tournaments branch

```js
          if (m[1]) want.push("/tournaments/" + m[1] + "/bracket")
        }
```

with

```js
          if (m[1]) want.push("/tournaments/" + m[1] + "/bracket")
        } else if ((m = /^\/cards\/([^/]+)$/.exec(p))) want.push("/card/" + m[1])
```

Vite adds its script and stylesheet tags just before `</head>`, after the head markers, so the server's head replacement never removes them. Step 4 checks the markers survive the build.

- [ ] **Step 4: Run the web suite and build**

Run: `npx vitest run --project web && npm run build:web && grep -c "seo:head:start" dist/web/index.html`
Expected: PASS; the built `index.html` still contains the markers (prints `1`).

- [ ] **Step 5: Commit**

```bash
git add src/web tests/web/seo-titles.test.tsx
git commit -m "Title pages from the shared metadata and add intros and footer links"
```

### Task 14: The guide page

**Files:**
- Create: `src/web/pages/Guide.tsx`
- Modify: `src/web/App.tsx`, `src/web/pages/About.tsx`, `src/web/styles/base.css`
- Test: `tests/web/guide.test.tsx`

**Interfaces:**
- Consumes: `GUIDE`, `GUIDE_INTRO`, `GUIDE_TITLE`, `GUIDE_CHECKED`, `GUIDE_MOD_VERSION` (Task 8), `pageMeta` (Task 2).
- Produces: route `/guide` → `Guide`; `ROUTE_PAGES` entry `[/^\/guide\/?$/, Guide]`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { Guide } from '../../src/web/pages/Guide'
import { GUIDE } from '../../src/shared/guide'

describe('Guide', () => {
  it('renders every section with its links, internal ones as app links', () => {
    renderApp(<Guide />)
    expect(document.title).toBe("How to play ranked ROUNDS: install Sid's Competitive Rounds · SCRmod")
    expect(screen.getByRole('heading', { level: 1, name: 'How to play ranked ROUNDS' })).toBeInTheDocument()
    for (const s of GUIDE) expect(screen.getByRole('heading', { level: 2, name: s.heading })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: "Sid's Competitive Rounds on Thunderstore" })[0]).toHaveAttribute('href', 'https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/')
    expect(screen.getByRole('link', { name: 'SCRmod leaderboards' })).toHaveAttribute('href', '/leaderboards/1v1')
    expect(screen.getByRole('cell', { name: 'F5' })).toBeInTheDocument()
    expect(screen.getByText(/Checked against mod v1\.40\.3/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/web/guide.test.tsx`
Expected: FAIL, cannot resolve `../../src/web/pages/Guide`.

- [ ] **Step 3: Implement**

`src/web/pages/Guide.tsx`:

```tsx
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { GUIDE, GUIDE_CHECKED, GUIDE_INTRO, GUIDE_MOD_VERSION, GUIDE_TITLE, type GuideBlock, type GuideInline } from '../../shared/guide'
import { pageMeta } from '../../shared/seo'
import { useTitle } from '../lib/title'

function Inline({ parts }: { parts: GuideInline[] }) {
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (typeof p === 'string') return <Fragment key={i}>{p}</Fragment>
        if ('href' in p)
          return p.href.startsWith('/') ? (
            <Link key={i} to={p.href}>
              {p.text}
            </Link>
          ) : (
            <a key={i} href={p.href} rel="noopener">
              {p.text}
            </a>
          )
        if ('code' in p) return <code key={i}>{p.code}</code>
        return <strong key={i}>{p.strong}</strong>
      })}
    </>
  )
}

function Block({ b }: { b: GuideBlock }) {
  if (b.type === 'p')
    return (
      <p>
        <Inline parts={b.content} />
      </p>
    )
  if (b.type === 'table')
    return (
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>{b.head[0]}</th>
              <th>{b.head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r) => (
              <tr key={r[0]}>
                <td>{r[0]}</td>
                <td>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  const List = b.type
  return (
    <List className="prose">
      {b.items.map((item, i) => (
        <li key={i}>
          <Inline parts={item} />
        </li>
      ))}
    </List>
  )
}

/** How to install Sid's Competitive Rounds and play ranked: the same content the server renders for crawlers. */
export function Guide() {
  useTitle(pageMeta({ kind: 'guide' }).title)
  const checked = new Date(`${GUIDE_CHECKED}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <>
      <h1>{GUIDE_TITLE}</h1>
      <p className="page-intro">
        <Inline parts={GUIDE_INTRO} />
      </p>
      {GUIDE.map((s) => (
        <section key={s.id} className="card guide" id={s.id} aria-labelledby={`${s.id}-h`}>
          <h2 id={`${s.id}-h`}>{s.heading}</h2>
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </section>
      ))}
      <p className="faint">
        Checked against mod v{GUIDE_MOD_VERSION} on {checked}.
      </p>
    </>
  )
}
```

`src/web/App.tsx`: add `const Guide = page(() => import('./pages/Guide'), 'Guide')`, include it in `LAZY`, add `[/^\/guide\/?$/, Guide]` to `ROUTE_PAGES`, and `<Route path="guide" element={<Guide.Component />} />` before the `*` route.

`src/web/pages/About.tsx`: in the "What this is" card, add a paragraph `<p>New to it? <Link to="/guide">How to install the mod and play ranked</Link>.</p>` (import `Link` from `react-router`).

`src/web/styles/base.css` (append):

```css
/* The guide's numbered steps read like the bulleted ones. */
ol.prose {
  max-width: 64ch;
  padding-left: 1.25rem;
}
ol.prose li + li {
  margin-top: var(--space-2xs);
}
.card.guide p {
  margin: var(--space-xs) 0;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/web/guide.test.tsx tests/web/about.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/pages/Guide.tsx src/web/App.tsx src/web/pages/About.tsx src/web/styles/base.css tests/web/guide.test.tsx
git commit -m "Add the ranked ROUNDS guide page"
```

### Task 15: Card pages, and the cards table linking to them

**Files:**
- Create: `src/web/pages/Card.tsx`
- Modify: `src/web/api/hooks.ts`, `src/web/api/types.ts`, `src/web/App.tsx`, `src/web/pages/Cards.tsx`, `tests/web/cards.test.tsx`
- Test: `tests/web/card-page.test.tsx`

**Interfaces:**
- Consumes: `CardPageData` (Task 5), `cardSlug`, `pageMeta` (Task 2), `/api/card/:slug` (Task 5).
- Produces: `useCard(slug: string | undefined)`, `type CardPageResponse = Env<CardPageData>`; `Pickers` exported from `Cards.tsx`; route `cards/:slug` → `Card`; `ROUTE_PAGES` entry `[/^\/cards\/[^/]+\/?$/, Card]` placed before the `/cards` entry.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env, jsonResponse } from './helpers/mockHub'
import { Card } from '../../src/web/pages/Card'

const data = {
  slug: 'big-bullet',
  card: { card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 1234, win_rate: 0.523, pass_rate: 0.31, times_offered: 2000, unique_players: 70, sweeps_with_card: 9 },
  ranked: { card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 500, win_rate: 0.6, pass_rate: 0.3, times_offered: 800, unique_players: 40, sweeps_with_card: 4 },
  casual: null,
  winners: [{ card: 'Big Bullet', player: 'Stan', count: 50 }],
  sweepers: [],
  prev: { name: 'Poison', slug: 'poison' },
  next: null,
}

describe('Card page', () => {
  it('shows the card, its ranked split, leaders and neighbours', async () => {
    mockHub({ '/card/big-bullet': env(data), '/cards/Big%20Bullet/pickers': env({ card_name: 'Big Bullet', display_names: [], steam_ids: [], picks: [], win_rates: [] }) })
    renderApp(<Card />, { route: '/cards/big-bullet', path: '/cards/:slug' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Big Bullet' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Big Bullet: ROUNDS card win rate and stats · SCRmod'))
    const overall = screen.getByRole('region', { name: 'All games' })
    expect(within(overall).getByText('52%')).toBeInTheDocument()
    expect(within(overall).getByText('1,234')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Ranked games' })).getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('Stan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Poison' })).toHaveAttribute('href', '/cards/poison')
  })

  it('says so when the card does not exist', async () => {
    mockHub({ '/card/nope': () => jsonResponse({ error: 'not_found' }, 404) })
    renderApp(<Card />, { route: '/cards/nope', path: '/cards/:slug' })
    expect(await screen.findByText(/card not found/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/web/card-page.test.tsx`
Expected: FAIL, cannot resolve `../../src/web/pages/Card`.

- [ ] **Step 3: Implement**

`src/web/api/types.ts`: add `import type { CardPageData } from '../../shared/hub-types'` and `export type CardPageResponse = Env<CardPageData>`.

`src/web/api/hooks.ts`:

```ts
export function useCard(slug: string | undefined) {
  return useQuery({
    queryKey: ['card', slug],
    queryFn: () => hubGet<CardPageResponse>(`/card/${encodeURIComponent(slug!)}`),
    enabled: !!slug,
    ...ref,
  })
}
```

(add `CardPageResponse` to the `./types` import).

`src/web/pages/Cards.tsx`: export the `Pickers` component (`export function Pickers`), and in `CardTable` replace the first cell's disclosure button with a link plus an icon-only disclosure:

```tsx
                <td className="stick-lead">
                  <span className="row tight">
                    <button className="disclosure" onClick={() => setOpen(open === c.card_name ? null : c.card_name)} aria-expanded={open === c.card_name} aria-label={`Top pickers of ${c.card_name}`}>
                      <Icon name="chevron" size={16} />
                    </button>
                    <Link to={`/cards/${cardSlug(c.card_name)}`}>{c.card_name}</Link>
                  </span>
                </td>
```

(imports: `Link` from `react-router`, `cardSlug` from `../../shared/seo`).

`tests/web/cards.test.tsx`: change `screen.getByRole('button', { name: list[0].card_name })` to `screen.getByRole('button', { name: `Top pickers of ${list[0].card_name}` })`, and add `expect(screen.getByRole('link', { name: list[0].card_name })).toHaveAttribute('href', expect.stringMatching(/^\/cards\/[a-z0-9-]+$/))`.

`src/web/pages/Card.tsx`:

```tsx
import { useId } from 'react'
import { Link, useParams } from 'react-router'
import type { CardStat } from '../../shared/api-types'
import { pageMeta } from '../../shared/seo'
import { useCard } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { StatTile } from '../components/StatTile'
import { num, pct } from '../lib/format'
import { useTitle } from '../lib/title'
import { Pickers } from './Cards'

function StatStrip({ title, s }: { title: string; s: CardStat }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="tiles">
        <StatTile label="Win rate" value={pct(s.win_rate)} />
        <StatTile label="Picks" value={num(s.times_picked)} />
        <StatTile label="Offered" value={num(s.times_offered)} />
        <StatTile label="Pass rate" value={pct(s.pass_rate)} />
        <StatTile label="Players" value={num(s.unique_players)} />
        <StatTile label="5-0 sweeps" value={num(s.sweeps_with_card)} />
      </div>
    </section>
  )
}

/** One card: how it does overall, in ranked and casual play, who picks it and who wins with it. */
export function Card() {
  const { slug } = useParams()
  const q = useCard(slug)
  const d = q.data?.data
  useTitle(
    pageMeta({ kind: 'card', slug: slug ?? '' }, d ? { card: { name: d.card.card_name, rarity: d.card.card_rarity, win_rate: d.card.win_rate, times_picked: d.card.times_picked, pass_rate: d.card.pass_rate } } : {}).title,
  )
  return (
    <QueryState q={q} label="card">
      {(p) => (
        <>
          <h1>{p.card.card_name}</h1>
          <p className="page-intro">
            <span className={`rarity-${String(p.card.card_rarity).toLowerCase()}`}>{p.card.card_rarity}</span> card ·{' '}
            <Link to="/cards">All cards</Link>
          </p>
          <StatStrip title="All games" s={p.card} />
          {p.ranked ? <StatStrip title="Ranked games" s={p.ranked} /> : null}
          {p.casual ? <StatStrip title="Casual games" s={p.casual} /> : null}
          <div className="grid-2">
            <div className="card">
              <h2>Top pickers</h2>
              <Pickers name={p.card.card_name} />
            </div>
            <div className="card">
              <h2>Most wins with it</h2>
              {p.winners.length ? (
                <ul className="plain-list">
                  {p.winners.slice(0, 10).map((w, i) => (
                    <li key={i} className="row list-row">
                      <bdi>{w.player}</bdi>
                      <span className="spacer" />
                      <span className="tnum">{num(w.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">No leaders for this card yet.</div>
              )}
            </div>
          </div>
          <nav className="row" aria-label="Other cards">
            {p.prev ? <Link to={`/cards/${p.prev.slug}`}>← {p.prev.name}</Link> : null}
            <span className="spacer" />
            {p.next ? <Link to={`/cards/${p.next.slug}`}>{p.next.name} →</Link> : null}
          </nav>
        </>
      )}
    </QueryState>
  )
}
```

`src/web/App.tsx`: `const Card = page(() => import('./pages/Card'), 'Card')`, add to `LAZY`, put `[/^\/cards\/[^/]+\/?$/, Card]` before the `/cards` entry in `ROUTE_PAGES`, and add `<Route path="cards/:slug" element={<Card.Component />} />` after the `cards` route.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/web/card-page.test.tsx tests/web/cards.test.tsx tests/web/structure.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web tests/web/card-page.test.tsx tests/web/cards.test.tsx
git commit -m "Add a page per card and link the cards table to them"
```

---

## Phase D: the live stream

### Task 16: `/api/stream`

**Files:**
- Create: `src/server/stream.ts`, `fixtures/stream.json`
- Modify: `src/shared/hub-types.ts`, `src/server/app.ts`, `tests/server/helpers/makeApp.ts`
- Test: `tests/server/stream.test.ts`

**Interfaces:**
- Consumes: `Env.stream` (Task 6), `LINKS` (Task 2), `Cache` (existing).
- Produces:
  - in `hub-types.ts`: `interface StreamLive { platform: 'twitch' | 'youtube'; title: string; viewers: number | null; started_at: string | null; url: string; embed: { kind: 'twitch'; channel: string } | { kind: 'youtube'; videoId: string } }`, `interface StreamVideo { title: string; url: string; videoId: string; published_at: string }`, `interface StreamData { live: StreamLive | null; recent: StreamVideo[]; links: { twitch: string; youtube: string } }`.
  - in `stream.ts`: `parseYouTubeFeed(xml: string): StreamVideo[]`, `class TwitchClient`, `registerStreamRoutes(app, d, fetchImpl: typeof fetch)`.
  - `AppDeps.streamFetch?: typeof fetch`; `makeApp(map, env, nowRef, store, streamFetch?)`.

- [ ] **Step 1: Let tests inject the stream fetch**

In `src/server/app.ts` add `streamFetch?: typeof fetch` to `AppDeps` (comment: "fetch used for Twitch and YouTube; defaults to the global fetch"). In `tests/server/helpers/makeApp.ts` add a fifth parameter `streamFetch?: typeof fetch` passed into `createApp({ …, streamFetch })`.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { parseYouTubeFeed } from '../../src/server/stream'

const FEED = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><title>Sid's Competitive Rounds</title>
${[1, 2, 3, 4, 5].map((i) => `<entry><yt:videoId>vid${i}</yt:videoId><title>Spirit &amp; galaxy ice #${i}</title><published>2026-09-2${i}T07:06:15+00:00</published></entry>`).join('')}</feed>`

type Route = (url: URL, init?: RequestInit) => Response
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = []
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    calls.push(`${url.host}${url.pathname}`)
    const hit = routes[`${url.host}${url.pathname}`]
    return hit ? hit(url, init) : new Response('nope', { status: 404 })
  }) as unknown as typeof fetch
  return { impl, calls }
}
const ok = (body: unknown) => () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 })
const feed = { 'www.youtube.com/feeds/videos.xml': ok(FEED) }
const token = { 'id.twitch.tv/oauth2/token': ok({ access_token: 't1', expires_in: 3600 }) }
const TWITCH_ENV = { TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'sec' }

async function stream(env: Record<string, string>, routes: Record<string, Route>, nowRef = { now: 1_000_000 }) {
  const f = fakeFetch(routes)
  const { app } = makeApp({}, env, nowRef, undefined, f.impl)
  return { get: async () => (await (await app.request('/api/stream')).json()).data, calls: f.calls, nowRef }
}

describe('parseYouTubeFeed', () => {
  it('reads id, decoded title, link and date for each entry, not the channel title', () => {
    const v = parseYouTubeFeed(FEED)
    expect(v).toHaveLength(5)
    expect(v[0]).toEqual({ videoId: 'vid1', title: 'Spirit & galaxy ice #1', url: 'https://www.youtube.com/watch?v=vid1', published_at: '2026-09-21T07:06:15+00:00' })
  })
})

describe('/api/stream', () => {
  it('without keys: offline, with the 4 latest broadcasts and the channel links', async () => {
    const s = await stream({}, feed)
    const d = await s.get()
    expect(d.live).toBeNull()
    expect(d.recent.map((v: { videoId: string }) => v.videoId)).toEqual(['vid1', 'vid2', 'vid3', 'vid4'])
    expect(d.links).toEqual({ twitch: 'https://www.twitch.tv/sidscompetitiverounds', youtube: 'https://www.youtube.com/@SidsCompetitiveRounds' })
    expect(s.calls.some((c) => c.includes('twitch'))).toBe(false)
  })

  it('Twitch live: reports the stream and reuses its token', async () => {
    const s = await stream(TWITCH_ENV, {
      ...feed,
      ...token,
      'api.twitch.tv/helix/streams': (url, init) => {
        expect(url.searchParams.get('user_login')).toBe('sidscompetitiverounds')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer t1')
        return new Response(JSON.stringify({ data: [{ type: 'live', title: 'Ranked night', viewer_count: 42, started_at: '2026-09-23T18:00:00Z' }] }))
      },
    })
    expect((await s.get()).live).toEqual({ platform: 'twitch', title: 'Ranked night', viewers: 42, started_at: '2026-09-23T18:00:00Z', url: 'https://www.twitch.tv/sidscompetitiverounds', embed: { kind: 'twitch', channel: 'sidscompetitiverounds' } })
    await s.get() // within 60 s: from the cache
    expect(s.calls.filter((c) => c === 'api.twitch.tv/helix/streams')).toHaveLength(1)
    s.nowRef.now += 61_000
    await s.get()
    expect(s.calls.filter((c) => c === 'id.twitch.tv/oauth2/token')).toHaveLength(1)
    expect(s.calls.filter((c) => c === 'api.twitch.tv/helix/streams')).toHaveLength(2)
    expect(s.calls.filter((c) => c === 'www.youtube.com/feeds/videos.xml')).toHaveLength(1) // the feed is cached for 5 minutes
  })

  it('refreshes an expired Twitch token once', async () => {
    let n = 0
    const s = await stream(TWITCH_ENV, {
      ...feed,
      ...token,
      'api.twitch.tv/helix/streams': () => (n++ === 0 ? new Response('', { status: 401 }) : new Response(JSON.stringify({ data: [] }))),
    })
    expect((await s.get()).live).toBeNull()
    expect(s.calls.filter((c) => c === 'id.twitch.tv/oauth2/token')).toHaveLength(2)
  })

  it('YouTube live with an API key; Twitch wins when both are live', async () => {
    const videos = ok({ items: [{ id: 'vid2', snippet: { title: 'Live now' }, liveStreamingDetails: { actualStartTime: '2026-09-23T18:00:00Z', concurrentViewers: '12' } }, { id: 'vid1', liveStreamingDetails: { actualStartTime: 'x', actualEndTime: 'y' } }] })
    const yt = await stream({ YOUTUBE_API_KEY: 'k' }, { ...feed, 'www.googleapis.com/youtube/v3/videos': videos })
    expect((await yt.get()).live).toEqual({ platform: 'youtube', title: 'Live now', viewers: 12, started_at: '2026-09-23T18:00:00Z', url: 'https://www.youtube.com/watch?v=vid2', embed: { kind: 'youtube', videoId: 'vid2' } })
    const both = await stream({ ...TWITCH_ENV, YOUTUBE_API_KEY: 'k' }, { ...feed, ...token, 'www.googleapis.com/youtube/v3/videos': videos, 'api.twitch.tv/helix/streams': ok({ data: [{ type: 'live', title: 'T', viewer_count: 1, started_at: null }] }) })
    expect((await both.get()).live.platform).toBe('twitch')
    const quota = await stream({ YOUTUBE_API_KEY: 'k' }, { ...feed, 'www.googleapis.com/youtube/v3/videos': () => new Response('{"error":{"code":403}}', { status: 403 }) })
    const q = await quota.get()
    expect(q.live).toBeNull()
    expect(q.recent).toHaveLength(4)
  })

  it('outages degrade to offline with no broadcasts, never an error', async () => {
    const s = await stream(TWITCH_ENV, { 'id.twitch.tv/oauth2/token': () => new Response('', { status: 500 }) })
    const res = await s.get()
    expect(res.live).toBeNull()
    expect(res.recent).toEqual([])
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/server/stream.test.ts`
Expected: FAIL, cannot resolve `../../src/server/stream`.

- [ ] **Step 4: Implement**

Add the three interfaces from **Interfaces** above to `src/shared/hub-types.ts`.

Create `src/server/stream.ts`:

```ts
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Hono } from 'hono'
import type { StreamData, StreamLive, StreamVideo } from '../shared/hub-types'
import { LINKS } from '../shared/links'
import type { RouteDeps } from './routes/common'

const TIMEOUT_MS = 5000
const FEED_TTL = { ttlMs: 300_000, staleMs: 3_600_000 }
const LIVE_TTL = { ttlMs: 60_000, staleMs: 0 }

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** The channel's public uploads feed, newest first. */
export function parseYouTubeFeed(xml: string): StreamVideo[] {
  const out: StreamVideo[] = []
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1]
    const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(e)?.[1]
    const title = /<title>([^<]*)<\/title>/.exec(e)?.[1]
    const published = /<published>([^<]+)<\/published>/.exec(e)?.[1]
    if (!videoId || title === undefined) continue
    out.push({ videoId, title: decodeXml(title), url: `https://www.youtube.com/watch?v=${videoId}`, published_at: published ?? '' })
  }
  return out
}

/** Twitch Helix with an app access token (client credentials), refreshed once on a 401. */
export class TwitchClient {
  private token: string | null = null

  constructor(private readonly opts: { clientId: string; clientSecret: string; fetchImpl: typeof fetch }) {}

  private async fetchToken(): Promise<string> {
    const body = new URLSearchParams({ client_id: this.opts.clientId, client_secret: this.opts.clientSecret, grant_type: 'client_credentials' })
    const res = await this.opts.fetchImpl('https://id.twitch.tv/oauth2/token', { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`twitch token ${res.status}`)
    const json = (await res.json()) as { access_token?: string }
    if (!json.access_token) throw new Error('twitch token missing')
    this.token = json.access_token
    return this.token
  }

  private async helix(pathAndQuery: string): Promise<Response> {
    const call = async (token: string) =>
      this.opts.fetchImpl(`https://api.twitch.tv/helix${pathAndQuery}`, {
        headers: { 'Client-Id': this.opts.clientId, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    let res = await call(this.token ?? (await this.fetchToken()))
    if (res.status === 401) res = await call(await this.fetchToken())
    if (!res.ok) throw new Error(`twitch ${res.status}`)
    return res
  }

  async live(login: string): Promise<StreamLive | null> {
    const res = await this.helix(`/streams?user_login=${encodeURIComponent(login)}`)
    const s = ((await res.json()) as { data?: Array<{ type?: string; title?: string; viewer_count?: number; started_at?: string }> }).data?.[0]
    if (!s || s.type !== 'live') return null
    return { platform: 'twitch', title: s.title ?? '', viewers: s.viewer_count ?? null, started_at: s.started_at ?? null, url: `https://www.twitch.tv/${login}`, embed: { kind: 'twitch', channel: login } }
  }
}

async function youtubeLive(ids: string[], apiKey: string, fetchImpl: typeof fetch): Promise<StreamLive | null> {
  if (!ids.length) return null
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${ids.map(encodeURIComponent).join(',')}&key=${encodeURIComponent(apiKey)}`
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`youtube ${res.status}`)
  const items = ((await res.json()) as { items?: Array<{ id: string; snippet?: { title?: string }; liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string; concurrentViewers?: string } }> }).items ?? []
  const v = items.find((i) => i.liveStreamingDetails?.actualStartTime && !i.liveStreamingDetails.actualEndTime)
  if (!v) return null
  const viewers = Number(v.liveStreamingDetails?.concurrentViewers)
  return {
    platform: 'youtube',
    title: v.snippet?.title ?? '',
    viewers: Number.isFinite(viewers) ? viewers : null,
    started_at: v.liveStreamingDetails?.actualStartTime ?? null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    embed: { kind: 'youtube', videoId: v.id },
  }
}

/** GET /api/stream: is the community live on Twitch or YouTube, and what did it broadcast lately. Never fails. */
export function registerStreamRoutes(app: Hono, d: RouteDeps, fetchImpl: typeof fetch) {
  const s = d.env.stream
  const twitch = s.twitchClientId && s.twitchClientSecret ? new TwitchClient({ clientId: s.twitchClientId, clientSecret: s.twitchClientSecret, fetchImpl }) : null
  const links = { twitch: LINKS.twitch, youtube: LINKS.youtube }

  app.get('/api/stream', async (c) => {
    c.header('Cache-Control', 'public, max-age=30')
    if (d.env.fixtures) {
      let data: StreamData = { live: null, recent: [], links }
      try {
        data = JSON.parse(await readFile(path.join(d.env.fixturesDir, 'stream.json'), 'utf8')) as StreamData
      } catch {
        // no fixture: offline
      }
      return c.json({ data, fetched_at: new Date(d.now()).toISOString(), stale: false })
    }

    const [feedR, twitchR] = await Promise.allSettled([
      d.cache.get('stream:yt-feed', FEED_TTL, async () => {
        const res = await fetchImpl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(s.youtubeChannelId)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
        if (!res.ok) throw new Error(`feed ${res.status}`)
        return parseYouTubeFeed(await res.text())
      }),
      twitch ? d.cache.get('stream:twitch', LIVE_TTL, () => twitch.live(s.twitchLogin)) : Promise.resolve(null),
    ])
    const recent = feedR.status === 'fulfilled' ? feedR.value.value : []
    let live: StreamLive | null = twitchR.status === 'fulfilled' && twitchR.value ? twitchR.value.value : null
    if (!live && s.youtubeApiKey && recent.length) {
      try {
        const key = s.youtubeApiKey
        live = (await d.cache.get('stream:yt-live', LIVE_TTL, () => youtubeLive(recent.slice(0, 5).map((v) => v.videoId), key, fetchImpl))).value
      } catch {
        live = null
      }
    }
    const data: StreamData = { live, recent: recent.slice(0, 4), links }
    return c.json({ data, fetched_at: new Date(d.now()).toISOString(), stale: false })
  })
}
```

In `src/server/app.ts`: import `registerStreamRoutes` and call `registerStreamRoutes(app, routeDeps, deps.streamFetch ?? fetch)` after the card routes.

Create `fixtures/stream.json` (used by `npm run preview` and the local browser pass):

```json
{
  "live": {
    "platform": "youtube",
    "title": "Zezima (1480) vs NotNic (1101) — Ranked BO3 [0-0] | Sid's Competitive Rounds",
    "viewers": 14,
    "started_at": "2026-09-23T08:21:24Z",
    "url": "https://www.youtube.com/watch?v=q4FLmnOqvto",
    "embed": { "kind": "youtube", "videoId": "q4FLmnOqvto" }
  },
  "recent": [
    { "title": "Spirit (1868) vs galaxy ice (1818) — Ranked BO3 [0-1] | Sid's Competitive Rounds", "url": "https://www.youtube.com/watch?v=C3KMBsQz6ZM", "videoId": "C3KMBsQz6ZM", "published_at": "2026-09-23T07:06:15+00:00" },
    { "title": "Stan (2065), SlopsOn1 (1436), NotNic (1317), TechTara (1313) — Ranked FFA | Sid's Competitive Rounds", "url": "https://www.youtube.com/watch?v=PcgyuoLGKtk", "videoId": "PcgyuoLGKtk", "published_at": "2026-09-23T01:22:08+00:00" }
  ],
  "links": { "twitch": "https://www.twitch.tv/sidscompetitiverounds", "youtube": "https://www.youtube.com/@SidsCompetitiveRounds" }
}
```

(These are real broadcasts from the channel's feed, checked 2026-09-23, so the browser pass plays an actual video. The fixture marks one as live so the live card can be seen; to see the "Recent broadcasts" state instead, set `"live": null`.)

- [ ] **Step 5: Run the test and the server suite**

Run: `npx vitest run tests/server/stream.test.ts && npx vitest run --project server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/stream.ts src/server/app.ts src/shared/hub-types.ts fixtures/stream.json tests/server/helpers/makeApp.ts tests/server/stream.test.ts
git commit -m "Report the community's live stream and recent broadcasts"
```

### Task 17: The live card and recent broadcasts

**Files:**
- Create: `src/web/components/Stream.tsx`
- Modify: `src/web/api/hooks.ts`, `src/web/api/types.ts`, `src/web/components/Icon.tsx`, `src/web/pages/Home.tsx`, `src/web/pages/Tournaments.tsx`, `src/web/pages/About.tsx`, `src/web/styles/base.css`
- Test: `tests/web/stream.test.tsx`

**Interfaces:**
- Consumes: `/api/stream` and `StreamData` (Task 16).
- Produces: `useStream()`, `type StreamResponse = Env<StreamData>`; `StreamCard` (renders nothing unless live) and `RecentBroadcasts` (renders nothing when live or empty).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { RecentBroadcasts, StreamCard } from '../../src/web/components/Stream'

const links = { twitch: 'https://www.twitch.tv/sidscompetitiverounds', youtube: 'https://www.youtube.com/@SidsCompetitiveRounds' }
const recent = [{ title: 'Spirit vs galaxy ice', url: 'https://www.youtube.com/watch?v=v1', videoId: 'v1', published_at: '2026-09-23T07:06:15Z' }]

describe('stream', () => {
  it('shows a live Twitch stream but loads no player until play is pressed', async () => {
    mockHub({ '/stream': env({ live: { platform: 'twitch', title: 'Ranked night', viewers: 42, started_at: null, url: links.twitch, embed: { kind: 'twitch', channel: 'sidscompetitiverounds' } }, recent: [], links }) })
    renderApp(<StreamCard />)
    const play = await screen.findByRole('button', { name: /watch ranked night here/i })
    expect(screen.getByText(/Twitch · 42 watching/)).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
    await userEvent.click(play)
    const frame = document.querySelector('iframe')!
    expect(frame.src).toContain('https://player.twitch.tv/?channel=sidscompetitiverounds&parent=localhost')
    expect(frame).toHaveAttribute('title', 'Ranked night on Twitch')
  })

  it('uses YouTube privacy-enhanced mode', async () => {
    mockHub({ '/stream': env({ live: { platform: 'youtube', title: 'Live', viewers: null, started_at: null, url: 'https://www.youtube.com/watch?v=v9', embed: { kind: 'youtube', videoId: 'v9' } }, recent, links }) })
    renderApp(<StreamCard />)
    await userEvent.click(await screen.findByRole('button', { name: /watch live here/i }))
    expect(document.querySelector('iframe')!.src).toBe('https://www.youtube-nocookie.com/embed/v9?autoplay=1')
  })

  it('stays hidden when offline, and lists recent broadcasts instead', async () => {
    mockHub({ '/stream': env({ live: null, recent, links }) })
    renderApp(
      <>
        <StreamCard />
        <RecentBroadcasts />
      </>,
    )
    expect(await screen.findByRole('link', { name: 'Spirit vs galaxy ice' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=v1')
    expect(screen.queryByText(/live on stream/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/web/stream.test.tsx`
Expected: FAIL, cannot resolve `../../src/web/components/Stream`.

- [ ] **Step 3: Implement**

`src/web/api/types.ts`: `import type { StreamData } from '../../shared/hub-types'` and `export type StreamResponse = Env<StreamData>`.

`src/web/api/hooks.ts`:

```ts
export function useStream() {
  return useQuery({ queryKey: ['stream'], queryFn: () => hubGet<StreamResponse>('/stream'), refetchInterval: 60_000, refetchIntervalInBackground: false, staleTime: 30_000 })
}
```

`src/web/components/Icon.tsx`: add `play: <path d="M8 5.5v13l10.5-6.5Z" />,` to `PATHS`.

`src/web/components/Stream.tsx`:

```tsx
import { useId, useState } from 'react'
import { useStream } from '../api/hooks'
import { relTime, num } from '../lib/format'
import { Icon } from './Icon'

const PLATFORM = { twitch: 'Twitch', youtube: 'YouTube' } as const

/**
 * The community's live stream, when there is one. Nothing is requested from Twitch or YouTube until the visitor
 * presses play: the card is drawn in the site's own style, and the player replaces it on demand.
 */
export function StreamCard() {
  const q = useStream()
  const [playing, setPlaying] = useState(false)
  const id = useId()
  const live = q.data?.data.live
  if (!live) return null
  const platform = PLATFORM[live.platform]
  const src =
    live.embed.kind === 'twitch'
      ? `https://player.twitch.tv/?channel=${encodeURIComponent(live.embed.channel)}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(live.embed.videoId)}?autoplay=1`
  return (
    <section className="card stream" aria-labelledby={id}>
      <div className="card-head">
        <h2 id={id}>Live on stream</h2>
        <span className="muted">
          {platform}
          {live.viewers != null ? ` · ${num(live.viewers)} watching` : ''}
        </span>
      </div>
      {playing ? (
        <div className="stream-frame">
          <iframe src={src} title={`${live.title} on ${platform}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <button type="button" className="stream-play" onClick={() => setPlaying(true)} aria-label={`Watch ${live.title} here`}>
          <span className="chip live-pill">LIVE</span>
          <span className="stream-title">{live.title}</span>
          <span className="stream-cta">
            <Icon name="play" size={20} /> Watch here
          </span>
        </button>
      )}
      <p className="subline">
        <a href={live.url} rel="noopener">
          Open on {platform}
        </a>
        {live.started_at ? <span className="faint"> · started {relTime(live.started_at)}</span> : null}
      </p>
    </section>
  )
}

/** The latest ranked matches the channel broadcast, when nothing is live right now. */
export function RecentBroadcasts() {
  const q = useStream()
  const d = q.data?.data
  if (!d || d.live || !d.recent.length) return null
  return (
    <section className="card">
      <div className="card-head">
        <h2>Recent broadcasts</h2>
        <a href={d.links.youtube} className="muted" rel="noopener">
          YouTube →
        </a>
      </div>
      <ul className="plain-list">
        {d.recent.map((v) => (
          <li key={v.videoId} className="row list-row">
            <a href={v.url} rel="noopener">
              {v.title}
            </a>
            <span className="spacer" />
            <span className="faint">{relTime(v.published_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

`src/web/pages/Home.tsx`: render `<StreamCard />` directly after the intro line, and `<RecentBroadcasts />` after the "Latest results" section (both outside the `QueryState`, so they show even when the home data is loading).

`src/web/pages/Tournaments.tsx`: render `<StreamCard />` after the intro line.

`src/web/pages/About.tsx`: in the "Where the data comes from" list, add:

```tsx
          <li>The live stream player comes from Twitch or YouTube and only loads when you press play.</li>
          <li>Search engines may keep an older copy of a public page for a while after data changes. Player profile pages ask search engines not to index them.</li>
```

`src/web/styles/base.css` (append):

```css
/* The live stream: a play surface in the site's own style until the visitor asks for the player. */
.stream-play {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: var(--space-xs);
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: var(--space-md);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-elev);
  text-align: left;
}
@media (hover: hover) {
  .stream-play:hover {
    background: var(--bg-hover);
  }
}
.stream-title {
  font-size: var(--text-title);
  font-weight: 600;
}
.stream-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-meta);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-ink);
}
.stream-frame {
  aspect-ratio: 16 / 9;
}
.stream-frame iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/web/stream.test.tsx && npx vitest run --project web && npm run typecheck`
Expected: PASS (Home tests without a `/stream` mock still pass: the card renders nothing on a 404).

- [ ] **Step 5: Commit**

```bash
git add src/web tests/web/stream.test.tsx
git commit -m "Show the live stream with a click-to-play card and recent broadcasts"
```

---

## Phase E: verification and delivery

### Task 18: Full check, browser pass, push and PR

**Files:** none new (fixes only, if the checks find defects).

- [ ] **Step 1: Run everything**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck clean; all tests pass; build succeeds.

- [ ] **Step 2: Check the served HTML**

Run the built server on fixtures and inspect the raw HTML (no JavaScript):

```bash
SCR_FIXTURES=1 SCR_RATE_LIMIT=off PORT=8123 node dist/server/node.js &
curl -s localhost:8123/ | grep -E "<title>|canonical|application/ld\+json" | head -5
curl -s localhost:8123/cards/big-bullet | grep -E "<title>|og:description|<h1>"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" localhost:8123/leaderboards
curl -s -o /dev/null -w "%{http_code}\n" localhost:8123/nope
curl -s localhost:8123/robots.txt
curl -s localhost:8123/sitemap.xml | head -20
curl -s -D - -o /dev/null localhost:8123/players/76561199311926326 | grep -i x-robots-tag
```

Expected: per-page titles, a canonical link, JSON-LD; the card description with real numbers; `301 …/leaderboards/1v1`; `404`; robots and sitemap as tested; `x-robots-tag: noindex, follow` on the profile.

- [ ] **Step 3: Browser pass (one round, desktop and phone, both themes)**

With the preview server running, open `/`, `/guide`, `/cards`, `/cards/big-bullet`, `/leaderboards/2v2` at 1280px and 375px in dark and light:
- the shell is replaced by the app with no visible jump (the top bar and heading stay where they are);
- the live card appears on Home and Tournaments (fixture), pressing play loads the YouTube privacy-enhanced player, and nothing loads from youtube.com before that (check the network list);
- the guide and card pages match DESIGN.md (spacing scale, no orange except "you are here", tabular numbers);
- no console errors, no horizontal scroll, contrast sweep clean.
Fix every defect found in one batch, re-run the tests, confirm once, and stop.

- [ ] **Step 4: Validate structured data and previews on the built pages**

Paste the served HTML of `/`, `/guide` and `/cards/big-bullet` into Google's Rich Results Test (code mode) and the Schema.org validator: no errors. Check the Open Graph tags with a link-preview checker (or the Discord embed once deployed).

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin seo
gh pr create --base main --head seo --title "Search visibility: per-page SEO, guide, card pages and the live stream" --body-file <prepared body>
```

The PR body lists: what changed (by phase), the measurements from Step 2, the test counts, and the owner steps from spec section 9 (Railway variables, Search Console and sitemap submission, Bing import, backlinks from Thunderstore, the GitHub README, Twitch, YouTube and the Discord). No attribution lines.
