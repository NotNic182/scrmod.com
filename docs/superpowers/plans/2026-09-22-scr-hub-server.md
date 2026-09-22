# SCR Hub Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SCR Hub server: a Hono/TypeScript service that proxies an allowlisted set of Sid's Competitive Rounds read endpoints with caching, version discovery, privacy masking, fixture mode, Discord sign-in, and static SPA serving, deployable as a Node container or a Cloudflare Worker.

**Architecture:** One `createApp(deps)` factory builds a runtime-agnostic Hono app from an `Env`, a `fetch` implementation and a `CacheStore`. Named `/api/*` routes call an `Upstream` client that enforces the allowlist and headers, through a `Cache` that implements fresh / stale-while-revalidate / single-flight / stale-on-error. Two thin entries (`src/server/node.ts`, `src/server/worker.ts`) wire the runtime specifics. The frontend is a separate plan (`2026-09-22-scr-hub-web.md`) and only depends on the `/api/*` contract defined here.

**Tech Stack:** TypeScript 5, Hono 4, @hono/node-server, esbuild (server bundle), Vitest 3, wrangler 4 (Cloudflare Workers with static assets), Node 26, npm (no pnpm on this machine).

**Spec:** `docs/superpowers/specs/2026-09-22-scr-hub-design.md` — sections 4, 5, 6, 8, 9, 10, 11, 12 apply to this plan.

## Global Constraints

- Upstream base URL default `https://competitive-rounds.duckdns.org:8444`; all upstream paths live under `/api/v1` (spec 6.5).
- Every upstream request carries `User-Agent: scr-hub/<version> (+<site url>)` and either `X-Mod-Version: <discovered>` (community mode) or `X-Internal-Key: <key>` (hosted mode), never both (spec 6.2).
- Version discovery from `GET /api/v1/mod-version`, which returns `{"version":"1.40.3","min_version":"1.40.3", ...}`. Refresh every 10 minutes and immediately on any HTTP 426, then retry the request once (spec 6.2). Use the `version` field.
- Upstream timeout 8 s; at most 8 in-flight upstream requests (spec 6.2).
- Cache TTL / stale windows in milliseconds: LIVE 10 000 / 60 000, BOARD 30 000 / 120 000, RESULTS 20 000 / 120 000, PLAYER 60 000 / 300 000, REF 600 000 / 3 600 000 (spec 6.1).
- Privacy (spec 6.4): remove `discord_id` and `discord_username` always; keep `discord_display_name` only when `show_discord` is true; remove `gold_earned`, `gold_spent`, `bet_gold_net` when `hide_gold` is true; remove `appear_offline` and `hide_gold` themselves and add `gold_hidden: boolean`. Recent-series rows drop `p1_discord_id` and `p2_discord_id`; chat rows drop `discord_id`.
- Only allowlisted upstream paths may ever be requested (spec 6.1). Never proxy player-private endpoints: inventory, bets, blocks, mail, gold-sources, card-tiers, queue polls.
- Every hub JSON response is `{ data, fetched_at: <ISO string>, stale: <boolean> }`; `/api/home` and `/api/meta` add `errors: string[]` (spec 6.1, 6.3).
- Secrets (`SCR_INTERNAL_KEY`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`) never appear in any response, including `/api/_status`.
- Steam64 ids are exactly 17 digits; tournament ids are UUIDs; validate before building an upstream path.
- Node 26, npm, ESM everywhere (`"type": "module"`), strict TypeScript. Relative imports have no file extensions (bundler resolution); esbuild and wrangler bundle the server.
- Commit after every task with the message shown in that task. No attribution lines in commit messages.
- The live API is only touched by the capture script (Task 8), the contract check (Task 19) and the manual smoke steps; every automated test uses a fake `fetch`.

---

### Task 1: Repository scaffold and `/api/_status`

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`
- Create: `src/server/env.ts`, `src/server/app.ts`
- Test: `tests/server/status.test.ts`

**Interfaces:**
- Produces: `parseEnv(raw: Record<string, string | undefined>): Env`, the `Env` type, `modeOf(env): 'community' | 'hosted' | 'fixtures'`, and `createApp(deps: AppDeps): { app: Hono }`. Later tasks extend `AppDeps` and the return value.

- [ ] **Step 1: Initialise the package and install dependencies**

Run from `C:/Users/notni/Desktop/scr-hub` (the repo already has `.gitignore` and the spec):

```bash
npm init -y
npm pkg set type=module name=scr-hub version=0.1.0 private=true
npm install hono @hono/node-server
npm install -D typescript vitest tsx esbuild @types/node
```

- [ ] **Step 2: Write `package.json` scripts**

Replace the `scripts` block so the file contains exactly these scripts (keep the dependency blocks npm generated):

```json
{
  "scripts": {
    "dev:server": "tsx watch src/server/node.ts",
    "build:server": "esbuild src/server/node.ts --bundle --platform=node --target=node22 --format=esm --outfile=dist/server/node.js --banner:js=\"import { createRequire } from 'module'; const require = createRequire(import.meta.url);\"",
    "start": "node dist/server/node.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "capture": "node scripts/capture-fixtures.mjs",
    "contract": "node scripts/contract-check.mjs"
  }
}
```

(`build:web`, `build`, `deploy:cf` are added by the web plan and Task 17.)

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "tests", "scripts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/server/**/*.test.ts'],
        },
      },
    ],
  },
})
```

- [ ] **Step 5: Write the failing test**

`tests/server/status.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/server/app'
import { parseEnv } from '../../src/server/env'

describe('GET /api/_status', () => {
  it('reports community mode when no internal key is configured', async () => {
    const { app } = createApp({ env: parseEnv({}) })
    const res = await app.request('/api/_status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mode).toBe('community')
    expect(body.app_version).toBe('0.1.0')
  })

  it('reports hosted mode when SCR_INTERNAL_KEY is set and never echoes the key', async () => {
    const { app } = createApp({ env: parseEnv({ SCR_INTERNAL_KEY: 'sekrit' }) })
    const body = await (await app.request('/api/_status')).json()
    expect(body.mode).toBe('hosted')
    expect(JSON.stringify(body)).not.toContain('sekrit')
  })

  it('honours BASE_PATH', async () => {
    const { app } = createApp({ env: parseEnv({ BASE_PATH: '/hub/' }) })
    expect((await app.request('/hub/api/_status')).status).toBe(200)
    expect((await app.request('/api/_status')).status).toBe(404)
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/server/status.test.ts`
Expected: FAIL — cannot resolve `../../src/server/app`.

- [ ] **Step 7: Write `src/server/env.ts`**

```ts
export interface DiscordConfig {
  clientId: string
  clientSecret: string
  sessionSecret: string
}

export interface Env {
  upstreamBase: string
  internalKey?: string
  modVersionOverride?: string
  features: Set<string>
  basePath: string
  publicBaseUrl?: string
  discord?: DiscordConfig
  fixtures: boolean
  fixturesDir: string
  appVersion: string
  userAgent: string
}

export const DEFAULT_UPSTREAM = 'https://competitive-rounds.duckdns.org:8444'

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const appVersion = raw.SCR_APP_VERSION || '0.1.0'
  const publicBaseUrl = raw.PUBLIC_BASE_URL ? trimSlash(raw.PUBLIC_BASE_URL) : undefined
  let basePath = raw.BASE_PATH || '/'
  if (!basePath.startsWith('/')) basePath = '/' + basePath
  basePath = basePath.length > 1 ? trimSlash(basePath) : '/'
  const discord =
    raw.DISCORD_CLIENT_ID && raw.DISCORD_CLIENT_SECRET && raw.SESSION_SECRET
      ? {
          clientId: raw.DISCORD_CLIENT_ID,
          clientSecret: raw.DISCORD_CLIENT_SECRET,
          sessionSecret: raw.SESSION_SECRET,
        }
      : undefined
  return {
    upstreamBase: trimSlash(raw.SCR_UPSTREAM_BASE || DEFAULT_UPSTREAM),
    internalKey: raw.SCR_INTERNAL_KEY || undefined,
    modVersionOverride: raw.SCR_MOD_VERSION_OVERRIDE || undefined,
    features: new Set(
      (raw.SCR_FEATURES || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    basePath,
    publicBaseUrl,
    discord,
    fixtures: raw.SCR_FIXTURES === '1' || raw.SCR_FIXTURES === 'true',
    fixturesDir: raw.SCR_FIXTURES_DIR || 'fixtures',
    appVersion,
    userAgent: publicBaseUrl ? `scr-hub/${appVersion} (+${publicBaseUrl})` : `scr-hub/${appVersion}`,
  }
}

export function modeOf(env: Env): 'community' | 'hosted' | 'fixtures' {
  if (env.fixtures) return 'fixtures'
  return env.internalKey ? 'hosted' : 'community'
}
```

- [ ] **Step 8: Write `src/server/app.ts`**

```ts
import { Hono } from 'hono'
import { type Env, modeOf } from './env'

export interface AppDeps {
  env: Env
}

export function createApp(deps: AppDeps) {
  const { env } = deps
  const app = env.basePath === '/' ? new Hono() : new Hono().basePath(env.basePath)

  app.notFound((c) =>
    c.req.path.includes('/api/')
      ? c.json({ error: 'not_found' }, 404)
      : c.text('Not found', 404),
  )

  app.get('/api/_status', (c) =>
    c.json({ mode: modeOf(env), app_version: env.appVersion, features: [...env.features] }),
  )

  return { app }
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/server/status.test.ts`
Expected: PASS (3 tests). Then `npm run typecheck` — expected: no errors.

- [ ] **Step 10: Write `README.md` (stub, replaced in Task 16)**

```markdown
# SCR Hub

Browser companion for Sid's Competitive Rounds. See `docs/superpowers/specs/2026-09-22-scr-hub-design.md`.

Work in progress. `npm test` runs the test suite.
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold server package with env parsing and status route"
```

---

### Task 2: Shared upstream types and rank-tier helpers

**Files:**
- Create: `src/shared/api-types.ts`, `src/shared/hub-types.ts`, `src/shared/rank.ts`
- Test: `tests/server/rank.test.ts`

**Interfaces:**
- Produces: every upstream response type used by later tasks (names below are referenced verbatim later), `tierFor(rating, tiers)`, `FALLBACK_TIERS`, and the hub envelope types.

The shapes were captured from the live API on 2026-09-22. Optional (`?`) fields are ones an older server may omit; readers must tolerate absence.

- [ ] **Step 1: Write the failing test**

`tests/server/rank.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tierFor, FALLBACK_TIERS, type RankTier } from '../../src/shared/rank'

describe('tierFor', () => {
  it('returns the highest tier whose floor is at or below the rating', () => {
    expect(tierFor(2564, FALLBACK_TIERS).name).toBe('Grand Master')
    expect(tierFor(1980, FALLBACK_TIERS).name).toBe('Master')
    expect(tierFor(1979, FALLBACK_TIERS).name).toBe('Advanced')
    expect(tierFor(0, FALLBACK_TIERS).name).toBe('Beginner')
  })

  it('does not depend on the input order', () => {
    const shuffled: RankTier[] = [...FALLBACK_TIERS].reverse()
    expect(tierFor(1700, shuffled).name).toBe('Advanced')
  })

  it('falls back to the lowest tier for a negative or NaN rating', () => {
    expect(tierFor(-5, FALLBACK_TIERS).name).toBe('Beginner')
    expect(tierFor(Number.NaN, FALLBACK_TIERS).name).toBe('Beginner')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/rank.test.ts`
Expected: FAIL — cannot resolve `../../src/shared/rank`.

- [ ] **Step 3: Write `src/shared/rank.ts`**

```ts
export interface RankTier {
  floor: number
  name: string
  color: string
}

// Captured from GET /api/v1/rank-tiers on 2026-09-22. The server is the source of truth;
// this is only used before /api/meta has loaded or if it fails.
export const FALLBACK_TIERS: RankTier[] = [
  { floor: 2330, name: 'Grand Master', color: '#F487A9' },
  { floor: 1980, name: 'Master', color: '#55D846' },
  { floor: 1675, name: 'Advanced', color: '#77A3FC' },
  { floor: 1500, name: 'Intermediate', color: '#FDC777' },
  { floor: 0, name: 'Beginner', color: '#BB79EE' },
]

export function tierFor(rating: number, tiers: RankTier[]): RankTier {
  const sorted = [...tiers].sort((a, b) => b.floor - a.floor)
  const r = Number.isFinite(rating) ? rating : 0
  return sorted.find((t) => r >= t.floor) ?? sorted[sorted.length - 1]
}
```

- [ ] **Step 4: Write `src/shared/api-types.ts`**

```ts
// Upstream response shapes, verified against the live API on 2026-09-22.
// Readers must tolerate missing fields: use optional chaining and defaults.

export interface ModVersion {
  version: string
  min_version: string
}

export interface MaintenanceStatus {
  in_maintenance: boolean
}

export interface AlertItem {
  category?: string
  message: string
  expires_at?: string | null
  created_at?: string
}

export interface AlertsActive {
  rev: number
  alerts: AlertItem[]
}

export interface RankTiersResponse {
  tiers: Array<{ floor: number; name: string; color: string }>
}

// ── Leaderboards ──────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  rating: number
  rd: number
  total_matches: number
  wins: number
  losses: number
  win_rate: number
  level: number
  gold: number // -1 when the player hides gold
  title: string
  title_color: string
  rank_name: string
  rank_color: string
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  total_players: number
  last_updated: string
}

export interface TeamLeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  rating: number
  rd: number
  peak_rating: number
  completed_series: number
  series_wins: number
  series_losses: number
  win_rate: number
  level: number
  title: string
  title_color: string
  avg_teammate_elo: number
  team_gold_earned: number
  team_xp_earned: number
}

export interface TeamLeaderboard {
  entries: TeamLeaderboardEntry[]
  total_players: number
  last_updated: string
}

export interface FfaLeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  rating: number
  rd: number
  peak_rating: number
  games_played: number
  wins: number
  top3: number
  avg_placement: number
  win_rate: number
  level: number
  title: string
  title_color: string
  ffa_gold_earned: number // -1 when hidden
  ffa_xp_earned: number
}

export interface FfaLeaderboard {
  entries: FfaLeaderboardEntry[]
  total_players: number
  last_updated: string
  is_ranked: boolean
}

export interface OvtLeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  games_played: number
  wins: number
  losses: number
  win_rate: number // percent, e.g. 81.2 (unlike the other boards)
  solo_games: number
  duo_games: number
  solo_wins: number
  solo_losses: number
  duo_wins: number
  duo_losses: number
  level: number
  title: string
  title_color: string
  last_played: string
}

export interface OvtLeaderboard {
  entries: OvtLeaderboardEntry[]
  total_players: number
  last_updated: string
  is_ranked: boolean
}

// ── Presence, queues, live games ──────────────────────────────

export interface PresenceEntry {
  display_name: string
  steam_id: string
  rating: number
  title: string
  title_color: string
  minutes_ago: number
}

export interface PresenceOnline {
  online_count: number
  online: PresenceEntry[]
  recent: PresenceEntry[]
}

export interface QueueCount {
  searching: number
  total: number
  online: number
}

export interface TeamQueueCount {
  searching: number
}

export interface ActiveSeries {
  series_id: string
  p1_steam_id: string
  p1_name: string
  p1_rating: number
  p1_rd: number
  p1_wins: number
  p1_odds: number
  p1_bettable: boolean
  p2_steam_id: string
  p2_name: string
  p2_rating: number
  p2_rd: number
  p2_wins: number
  p2_odds: number
  p2_bettable: boolean
  live_p1_points: number
  live_p2_points: number
  bets_locked: boolean
  lock_reason: string | null
  is_private: boolean
  is_tournament: boolean
  tournament_kind: 'sync' | 'async' | null
  tournament_label: string
  phase: 'live' | 'pre_match'
  started_at: string | null
}

export interface ActiveSeriesList {
  series: ActiveSeries[]
}

export interface ActiveTeamSeries {
  series_id: string
  t1a_steam: string
  t1a_name: string
  t1b_steam: string
  t1b_name: string
  t2a_steam: string
  t2a_name: string
  t2b_steam: string
  t2b_name: string
  t1_rating: number
  t2_rating: number
  t1a_rating: number
  t1b_rating: number
  t2a_rating: number
  t2b_rating: number
  t1_wins: number
  t2_wins: number
  t1_odds: number
  t2_odds: number
  t1_bettable: boolean
  t2_bettable: boolean
  bets_locked: boolean
  lock_reason: string | null
  started_at: string | null
  dc_grace_until: string | null
  t1_color_name: string
  t1_color_hex: string
  t2_color_name: string
  t2_color_hex: string
  color_decided: boolean
}

export interface ActiveTeamSeriesList {
  series: ActiveTeamSeries[]
}

export interface FfaLobbyMember {
  rating: number
  established: boolean
  title_color: string
  title: string
  name: string
}

export interface FfaLobby {
  lobby_id: string
  host_name: string
  player_count: number
  max_players: number
  has_password: boolean
  age_seconds: number
  bets_open: boolean
  bet_targets: Array<{ id: string; name: string }>
  members: FfaLobbyMember[]
}

export interface FfaLobbies {
  lobbies: FfaLobby[]
  count: number
}

export interface SpectateGame {
  game_id: string
  mode: string
  source_ref: string
  roster_titles: string // pipe-joined
  roster_title_colors: string // pipe-joined
  roster_ratings: string // comma-joined
  roster: string
  phase: string
  names: string // comma-joined display names
  spectator_count: number
  spectator_cap: number
  spectatable: boolean
  disabled_reason: string
}

export interface SpectateGames {
  games: SpectateGame[]
}

// ── Results ───────────────────────────────────────────────────

export interface MultimodeEntry {
  mode: string // '1v1' | '2v2' | 'ffa' | 'ovt'
  id: string
  ended_at: string
  left_label: string
  right_label: string
  score: string
  left_rating_change: number | null
  right_rating_change: number | null
  settings: Record<string, unknown> | null
  bets: unknown[]
}

export interface MultimodeRecent {
  entries: MultimodeEntry[]
}

export interface SeriesBet {
  bettor_name: string
  bettor_steam_id: string
  amount: number
  payout: number
  odds_multiplier: number
  bet_on_name: string
  bet_on_steam_id: string
  won: boolean
}

export interface RecentSeries {
  series_id: string
  game_codes: string[]
  p1_name: string
  p1_steam_id: string
  p1_discord_id?: string | null // stripped by the hub
  p1_rating: number
  p1_rating_change: number
  p1_streak: number
  p2_name: string
  p2_steam_id: string
  p2_discord_id?: string | null // stripped by the hub
  p2_rating: number
  p2_rating_change: number
  p2_streak: number
  p1_series_wins: number
  p2_series_wins: number
  winner_name: string
  winner_steam_id: string
  completed_at: string
  rules: Record<string, unknown> | null
  bets: SeriesBet[]
  tournament: boolean
  tournament_label: string
}

export interface RecentSeriesList {
  series: RecentSeries[]
}

// ── Players ───────────────────────────────────────────────────

export interface PlayerSearchResult {
  steam_id: string
  display_name: string
  rating: number
}

export interface PlayerSearch {
  results: PlayerSearchResult[]
}

export interface RatingPoint {
  rating: number
  rd: number
  date: string
  period_end: string
}

export interface FfaRatingPoint {
  rating: number
  recorded_at: string
  date: string
  period_end: string
  rating_before: number
}

export interface TopCard {
  card_name: string
  times_picked: number
  wins_with: number
  win_rate: number
  times_offered?: number
  pass_rate?: number
}

export interface FormEntry {
  result: 'W' | 'L'
  ranked: boolean
  opponent: string
  score: string
  date: string
}

export interface PlayerProfile {
  steam_id: string
  display_name: string
  rating: number
  rating_deviation: number
  peak_rating: number
  total_matches: number
  wins: number
  losses: number
  win_rate: number
  ranked_enabled: boolean
  discord_id?: string | null // stripped by the hub
  discord_username?: string | null // stripped by the hub
  discord_display_name?: string | null // kept only when show_discord
  show_discord: boolean
  allow_spectators: boolean
  gold_earned?: number // removed when hide_gold
  gold_spent?: number // removed when hide_gold
  bullets_fired: number
  bullets_hit: number
  blocks_activated: number
  blocks_successful: number
  active_title: string
  active_title_color: string
  active_player_color_hex?: string
  active_player_color_name?: string
  hide_gold?: boolean // stripped by the hub
  appear_offline?: boolean // stripped by the hub
  last_match: string | null
  recent_rating_history: RatingPoint[]
  ffa_rating_history: FfaRatingPoint[]
  top_cards: TopCard[]
  worst_cards: TopCard[]
  level: number
  total_xp: number
  xp_into_level: number
  xp_for_next_level: number
  best_ranked_streak: number
  best_casual_streak: number
  best_ranked_game_streak: number
  current_ranked_game_streak: number
  best_ranked_series_streak: number
  current_ranked_series_streak: number
  ranked_series_wins: number
  ranked_series_losses: number
  casual_wins: number
  casual_losses: number
  sweeps_given: number
  sweeps_taken: number
  ranked_dc_count: number
  recent_form: FormEntry[]
  avg_fps: number
  avg_cards_per_game: number
  achievements_unlocked: number
  region_breakdown: Array<{ region: string; matches: number }>
  avg_game_seconds: number
  bets_won: number
  bets_lost: number
  bet_gold_net?: number // removed when hide_gold
  rank_name: string
  rank_color: string
  team_rating: number
  team_completed_series: number
  team_rating_deviation?: number
  team_peak_rating?: number
  team_standing?: number
  team_standing_population?: number
  ovt_solo_wins: number
  ovt_solo_losses: number
  ovt_duo_wins: number
  ovt_duo_losses: number
  ovt_standing?: number
  ovt_standing_population?: number
  ffa_games: number
  ffa_wins: number
  ffa_top3: number
  ffa_avg_placement: number
  ffa_avg_kills: number
  ffa_avg_damage: number
  ffa_rating?: number
  ffa_rating_deviation?: number
  ffa_peak_rating?: number
  ffa_standing?: number
  ffa_standing_population?: number
  mod_version: string | null
  // Head-to-head vs the viewer passed as ?viewer_steam_id= (all zero without a viewer)
  h2h_ranked_wins: number
  h2h_ranked_losses: number
  h2h_casual_wins: number
  h2h_casual_losses: number
  h2h_series_wins: number
  h2h_series_losses: number
  casual_matches: number
  ranked_dps: number
  ffa_dps: number
  self_death_pct: number
  deaths_total: number
  record_max_single_hit: number
  record_max_health: number
  ranked_unique_opponents: number
  ranked_total_series: number
  standing: number
  standing_population: number
}

export interface CardPick {
  card_name: string
  card_rarity: string
  pick_order: number
  round_number: number
  rolled: boolean
}

export interface PlayerMatch {
  match_id: string
  opponent_steam_id: string
  opponent_name: string
  opponent_title: string
  opponent_title_color: string
  player_rounds_won: number
  opponent_rounds_won: number
  player_points: number
  opponent_points: number
  won: boolean
  is_ranked: boolean
  ended_at: string
  cards_picked: CardPick[]
  opponent_cards_picked: CardPick[]
  series_id: string | null
  series_score: string | null
  series_rating_change: number | null
  xp_gained: number
  gold_gained: number
  series_gold_gained: number
  player_fps_avg: number | null
  opponent_fps_avg: number | null
  player_bullets_fired: number
  player_bullets_hit: number
  player_blocks_activated: number
  player_blocks_successful: number
  opp_bullets_fired: number
  opp_bullets_hit: number
  opp_blocks_activated: number
  opp_blocks_successful: number
  player_ping_avg: number | null
  opponent_ping_avg: number | null
  duration_seconds: number | null
  player_damage_dealt: number | null
  opp_damage_dealt: number | null
  rules: Record<string, unknown> | null
  sitting_head: boolean
  // *_timeline, point_times and *_end_stats strings exist upstream; the hub strips them.
}

export interface MatchesSummary {
  total: number
  ranked_matches: number
  casual_matches: number
  ranked_groups: number
}

export interface RatingHistory {
  steam_id: string
  display_name: string
  history: RatingPoint[]
}

export interface TeamHistoryEntry {
  series_id: string
  won: boolean
  score: string
  mate: string
  opponents: string[]
  rating_change: number
  completed_at: string
  rules: Record<string, unknown> | null
}

export interface TeamHistory {
  series: TeamHistoryEntry[]
}

export interface FfaHistoryEntry {
  match_id: string
  player_count: number
  placement: number
  rating_change: number
  kills: number
  rounds_won: number
  points_total: number
  ended_at: string
  settings: Record<string, unknown> | null
  participants: string[]
}

export interface FfaHistory {
  games: FfaHistoryEntry[]
}

export interface OvtHistoryEntry {
  match_id: string
  role: 'solo' | 'duo'
  won: boolean
  score: string
  solo: string
  duo: string[]
  ended_at: string
  gold_gained: number
  series_gold_gained: number
  rules: Record<string, unknown> | null
}

export interface OvtHistory {
  games: OvtHistoryEntry[]
}

export interface VsTopCards {
  player_steam_id: string
  opponent_steam_id: string
  player_cards: Array<{ card_name: string; picks: number; wins: number }>
  opponent_cards: Array<{ card_name: string; picks: number; wins: number }>
}

export interface TeamStats {
  steam_id: string
  display_name: string
  rating: number
  rating_deviation: number
  peak_rating: number
  completed_series: number
  series_wins: number
  series_losses: number
  series_win_rate: number
  match_wins: number
  match_losses: number
  current_streak: number
}

export interface AchievementDefinitions {
  achievements: Record<string, { name: string; desc: string }>
}

export interface PlayerAchievement {
  achievement_key: string
  unlocked_at: string | null
  unlocked: boolean
  name: string
  global_pct: number
  gold: number
}

export interface PlayerAchievements {
  steam_id: string
  achievements: PlayerAchievement[]
}

export interface PlayerByDiscord {
  steam_id: string
  display_name: string
  discord_id: string
  rating: number
  peak_rating: number
  level: number
}

// ── Cards ─────────────────────────────────────────────────────

export interface CardStat {
  card_name: string
  card_rarity: string
  times_picked: number
  matches_appeared: number
  unique_players: number
  wins_with_card: number
  win_rate: number
  times_offered: number
  pass_rate: number
  sweeps_with_card: number
  stacked_builds: number
}

export type CardStats = CardStat[]

export interface CardTopPickers {
  card_name: string
  display_names: string[]
  steam_ids: string[]
  picks: number[]
  win_rates: number[]
}

export interface CardLeadersSummary {
  sweepers: string[] // "Card Name|Player|count"
  winners: string[] // "Card Name|Player|count"
}

// ── Tournaments (router prefix /api/v1/tournaments) ───────────

export interface TournamentSignup {
  signup_id: string
  steam_id: string
  display_name: string
  signed_up_at: string
  is_speculative: boolean
  seed: number | null
  penalty_at_signup: number
  ready: boolean
  forfeited: boolean
  placed_rank: number | null
  progress_label: string | null
  rating: number
  title: string
  title_color: string
}

export interface TournamentMatch {
  match_id: string
  round: number
  bracket_side: string
  slot_idx: number
  p1_signup_id: string | null
  p2_signup_id: string | null
  p1_display_name: string | null
  p2_display_name: string | null
  prereq_match_ids: string[]
  is_bye: boolean
  status: string
  series_id: string | null
  winner_signup_id: string | null
  p1_series_wins: number | null
  p2_series_wins: number | null
  ready_deadline_at: string | null
  deadline_at?: string | null
  started_at: string | null
  ended_at: string | null
}

export interface TournamentCurrent {
  tournament_id: string | null
  status: string | null
  kind: 'sync' | 'async' | null
  default_start_ts: string | null
  scheduled_start_ts: string | null
  lock_at: string | null
  voting_closes_at: string | null
  started_at: string | null
  ended_at: string | null
  min_players: number
  max_players: number
  prize_players?: number
  prize_gold_1?: number
  prize_gold_2?: number
  prize_gold_3?: number
  prize_xp_1?: number
  prize_xp_2?: number
  prize_xp_3?: number
  signups: TournamentSignup[]
  matches: TournamentMatch[]
  time_slot_options: string[]
  time_slot_tallies: Array<{ slot_ts: string; votes: number }>
  force_vote_count: number
  photon_region?: string | null
}

export interface TournamentHistoryRow {
  tournament_id: string
  kind: 'sync' | 'async'
  format: string
  started_at: string
  ended_at: string
  prize_tier: string
  winner_display_name: string | null
  winner_steam_id: string | null
  runner_up_display_name: string | null
  runner_up_steam_id: string | null
  third_place_display_name: string | null
  third_place_steam_id: string | null
  signup_count: number
}

export interface TournamentParticipant {
  steam_id: string
  display_name: string
  seed: number
  elo: number
  placed_rank: number | null
  forfeited: boolean
  wins: number
  losses: number
  result_label: string
}

export interface TournamentHistoryDetail {
  tournaments: Array<{
    tournament_id: string
    kind: 'sync' | 'async'
    format: string
    started_at: string
    ended_at: string
    duration_seconds: number
    signup_count: number
    prize_gold_1: number
    prize_gold_2: number
    prize_gold_3: number
    prize_xp_1: number
    prize_xp_2: number
    prize_xp_3: number
    participants: TournamentParticipant[]
  }>
}

export interface BracketGame {
  n: number
  p1_rounds: number
  p2_rounds: number
  p1_points: number
  p2_points: number
  dur: number
  p1_fps: number
  p2_fps: number
  p1_ping: number
  p2_ping: number
  p1_hit_pct: number
  p2_hit_pct: number
  p1_blk_pct: number
  p2_blk_pct: number
  p1_cards: string // pipe-joined
  p2_cards: string // pipe-joined
}

export interface BracketDetail {
  matches: Array<{ match_id: string; games: BracketGame[] }>
}

export interface PlayerTournaments {
  steam_id: string
  winner_count: number
  runner_up_count: number
  third_place_count: number
  participant_count: number
  recent: unknown[]
}

// ── Chat, releases ────────────────────────────────────────────

export interface ChatMessage {
  source: string
  id: number
  steam_id: string
  discord_id?: string | null // stripped by the hub
  display_name: string
  rating: number
  title: string
  title_color: string
  channel: string
  message: string
  timestamp: string
}

export interface ChatRecent {
  messages: ChatMessage[]
}

export interface ReleasePost {
  author: string
  content: string
  posted_at: string
}

export interface ReleasesRecent {
  posts: ReleasePost[]
}
```

- [ ] **Step 5: Write `src/shared/hub-types.ts`**

```ts
import type {
  ActiveSeries,
  ActiveTeamSeries,
  AlertItem,
  FfaLobby,
  ModVersion,
  MultimodeEntry,
  PlayerProfile,
  PresenceOnline,
  ReleasePost,
  SpectateGame,
} from './api-types'
import type { RankTier } from './rank'

/** Every hub JSON response has this envelope. */
export interface HubEnvelope<T> {
  data: T
  fetched_at: string // ISO timestamp of the oldest upstream item in `data`
  stale: boolean
}

export interface HomeData {
  presence: PresenceOnline
  queue: { ranked_searching: number; team_searching: number; online: number }
  live: {
    series_1v1: ActiveSeries[]
    series_2v2: ActiveTeamSeries[]
    ffa_lobbies: FfaLobby[]
    spectate: SpectateGame[]
  }
  results: MultimodeEntry[]
  maintenance: boolean
  alerts: AlertItem[]
}

export interface HomeEnvelope extends HubEnvelope<HomeData> {
  errors: string[] // keys of upstream items that failed with nothing cached
}

export interface MetaData {
  rank_tiers: RankTier[]
  achievement_definitions: Record<string, { name: string; desc: string }>
  mod_version: ModVersion | null
  releases: ReleasePost[]
}

export interface MetaEnvelope extends HubEnvelope<MetaData> {
  errors: string[]
}

/** PlayerProfile after privacy masking (spec 6.4). */
export type HubProfile = Omit<
  PlayerProfile,
  'discord_id' | 'discord_username' | 'appear_offline' | 'hide_gold'
> & { gold_hidden: boolean }

export interface MeData {
  discord: { id: string; username: string; avatar: string | null; global_name: string | null } | null
  player: { steam_id: string; display_name: string; rating: number; peak_rating: number; level: number } | null
}

export interface MeResponse {
  data: MeData
  auth_enabled: boolean
}

export interface StatusResponse {
  mode: 'community' | 'hosted' | 'fixtures'
  app_version: string
  features: string[]
  auth_enabled: boolean
  upstream: {
    base: string
    version: { version: string | null; fetched_at: string | null; source: 'override' | 'discovered' | 'none' }
    reachable?: boolean
  }
  cache: { size: number }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/server/rank.test.ts` — expected PASS (3 tests). Run `npm run typecheck` — expected clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared tests/server/rank.test.ts
git commit -m "Add upstream API types, hub envelopes and rank-tier helper"
```

---

### Task 3: Upstream allowlist

**Files:**
- Create: `src/server/allowlist.ts`
- Test: `tests/server/allowlist.test.ts`

**Interfaces:**
- Produces: `isAllowed(path: string): boolean`, `assertAllowed(path: string): void` (throws `NotAllowedError`), `class NotAllowedError extends Error`, `ALLOWED_EXACT: ReadonlySet<string>`, `ALLOWED_PATTERNS: readonly RegExp[]`. Paths are relative to `/api/v1` and start with `/`.

- [ ] **Step 1: Write the failing test**

`tests/server/allowlist.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isAllowed, assertAllowed, NotAllowedError } from '../../src/server/allowlist'

const ME = '76561199311926326'
const SID = '76561198040410653'

describe('allowlist', () => {
  it.each([
    '/mod-version',
    '/health',
    '/admin/maintenance/status',
    '/alerts/active',
    '/rank-tiers',
    '/leaderboard',
    '/team/leaderboard',
    '/ffa/leaderboard',
    '/ovt/leaderboard',
    '/presence/online',
    '/queue/count',
    '/team/queue/count',
    '/series/active',
    '/team/series/active',
    '/ffa/lobbies',
    '/spectate/games',
    '/series/recent',
    '/series/recent-multimode',
    '/players/search',
    '/achievements/definitions',
    '/cards',
    '/cards/leaders-summary',
    '/cards/top-pickers',
    '/tournaments/current',
    '/tournaments/history',
    '/tournaments/history-detail',
    '/chat/recent',
    '/releases/recent',
    `/players/${ME}`,
    `/players/${ME}/matches`,
    `/players/${ME}/matches/summary`,
    `/players/${ME}/rating-history`,
    `/players/${ME}/team-history`,
    `/players/${ME}/ffa-history`,
    `/players/${ME}/ovt-history`,
    `/players/${ME}/vs/${SID}/top-cards`,
    '/players/by-discord/1299197810780143656',
    `/team/players/${ME}/team-stats`,
    `/achievements/${ME}`,
    '/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket-detail',
    `/tournaments/players/${ME}/tournaments`,
  ])('allows %s', (p) => {
    expect(isAllowed(p)).toBe(true)
  })

  it.each([
    '/admin/actions',
    '/admin/banned-users',
    '/internal/linked-players',
    `/players/${ME}/inventory`,
    `/players/${ME}/bets`,
    `/players/${ME}/blocks`,
    `/players/${ME}/gold-sources`,
    `/players/${ME}/card-tiers`,
    '/mail/inbox',
    `/queue/poll/${ME}`,
    '/h2h/1/2',
    '/players/notanid',
    '/players/1234',
    '/players/76561199311926326/../../admin/actions',
    'players/search', // must start with /
    '/leaderboard?limit=5', // query strings are not part of the path
  ])('rejects %s', (p) => {
    expect(isAllowed(p)).toBe(false)
  })

  it('assertAllowed throws NotAllowedError', () => {
    expect(() => assertAllowed('/admin/actions')).toThrow(NotAllowedError)
    expect(() => assertAllowed('/leaderboard')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/allowlist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/server/allowlist.ts`**

```ts
// The complete set of upstream paths (relative to /api/v1) the hub may ever request.
// Spec 6.1: anything not listed here cannot be requested, no matter what a route does.

export class NotAllowedError extends Error {
  constructor(path: string) {
    super(`upstream path not allowlisted: ${path}`)
    this.name = 'NotAllowedError'
  }
}

export const ALLOWED_EXACT: ReadonlySet<string> = new Set([
  '/mod-version',
  '/health',
  '/admin/maintenance/status',
  '/alerts/active',
  '/rank-tiers',
  '/leaderboard',
  '/team/leaderboard',
  '/ffa/leaderboard',
  '/ovt/leaderboard',
  '/presence/online',
  '/queue/count',
  '/team/queue/count',
  '/queue/recent-joins',
  '/series/active',
  '/team/series/active',
  '/ffa/lobbies',
  '/spectate/games',
  '/series/recent',
  '/series/recent-multimode',
  '/team/series/recent',
  '/ffa/recent',
  '/ovt/recent',
  '/players/search',
  '/achievements/definitions',
  '/cards',
  '/cards/leaders-summary',
  '/cards/top-pickers',
  '/compare/player-nemesis',
  '/tournaments/current',
  '/tournaments/history',
  '/tournaments/history-detail',
  '/chat/recent',
  '/releases/recent',
  '/records',
])

const STEAM = String.raw`\d{17}`
const UUID = String.raw`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`

export const ALLOWED_PATTERNS: readonly RegExp[] = [
  new RegExp(`^/players/${STEAM}$`),
  new RegExp(`^/players/${STEAM}/(matches|matches/summary|rating-history|team-history|ffa-history|ovt-history)$`),
  new RegExp(`^/players/${STEAM}/vs/${STEAM}/top-cards$`),
  new RegExp(String.raw`^/players/by-discord/\d{1,32}$`),
  new RegExp(`^/team/players/${STEAM}/team-stats$`),
  new RegExp(`^/achievements/${STEAM}$`),
  new RegExp(`^/tournaments/${UUID}/bracket-detail$`),
  new RegExp(`^/tournaments/players/${STEAM}/tournaments$`),
]

export function isAllowed(path: string): boolean {
  if (typeof path !== 'string' || !path.startsWith('/')) return false
  if (path.includes('?') || path.includes('#') || path.includes('..')) return false
  if (ALLOWED_EXACT.has(path)) return true
  return ALLOWED_PATTERNS.some((re) => re.test(path))
}

export function assertAllowed(path: string): void {
  if (!isAllowed(path)) throw new NotAllowedError(path)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/allowlist.test.ts` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/allowlist.ts tests/server/allowlist.test.ts
git commit -m "Add upstream path allowlist"
```

---

### Task 4: Mod version discovery

**Files:**
- Create: `src/server/version.ts`
- Test: `tests/server/version.test.ts`

**Interfaces:**
- Produces: `class ModVersionSource` with `current(): Promise<string>`, `refresh(): Promise<string>`, `state(): VersionState`; constructor options `{ baseUrl, userAgent, override?, fetchImpl?, refreshMs?, now? }`.

- [ ] **Step 1: Write the failing test**

`tests/server/version.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { ModVersionSource } from '../../src/server/version'

function fakeFetch(bodies: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = []
  let i = 0
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v))
    calls.push({ url, headers })
    const next = bodies[Math.min(i, bodies.length - 1)]
    i++
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

describe('ModVersionSource', () => {
  it('discovers the version from /api/v1/mod-version with the User-Agent header', async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: { version: '1.40.3', min_version: '1.40.3' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'scr-hub/test', fetchImpl })
    expect(await src.current()).toBe('1.40.3')
    expect(calls[0].url).toBe('https://up.test/api/v1/mod-version')
    expect(calls[0].headers['user-agent']).toBe('scr-hub/test')
    expect(src.state()).toMatchObject({ version: '1.40.3', source: 'discovered' })
  })

  it('caches for refreshMs and refreshes afterwards', async () => {
    let now = 1_000_000
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3' } }, { body: { version: '1.41.0' } }])
    const src = new ModVersionSource({
      baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, refreshMs: 600_000, now: () => now,
    })
    expect(await src.current()).toBe('1.40.3')
    now += 599_000
    expect(await src.current()).toBe('1.40.3')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    now += 2_000
    expect(await src.current()).toBe('1.41.0')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('refresh() forces a fetch and coalesces concurrent refreshes', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl })
    const [a, b] = await Promise.all([src.refresh(), src.refresh()])
    expect(a).toBe('1.40.3')
    expect(b).toBe('1.40.3')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('uses the override without ever fetching', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '9.9.9' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, override: '1.40.3' })
    expect(await src.current()).toBe('1.40.3')
    expect(await src.refresh()).toBe('1.40.3')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(src.state().source).toBe('override')
  })

  it('keeps the last known version when a refresh fails, and throws if nothing is known', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3' } }, { status: 500, body: { error: 'x' } }])
    let now = 0
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, now: () => now, refreshMs: 10 })
    expect(await src.current()).toBe('1.40.3')
    now = 100
    expect(await src.current()).toBe('1.40.3') // refresh failed, last value kept

    const bad = fakeFetch([{ status: 500, body: {} }])
    const empty = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl: bad.fetchImpl })
    await expect(empty.current()).rejects.toThrow()
    expect(empty.state().source).toBe('none')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/version.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Write `src/server/version.ts`**

```ts
export interface VersionState {
  version: string | null
  fetched_at: string | null
  source: 'override' | 'discovered' | 'none'
}

export interface ModVersionSourceOptions {
  baseUrl: string
  userAgent: string
  override?: string
  fetchImpl?: typeof fetch
  refreshMs?: number
  now?: () => number
  timeoutMs?: number
}

/**
 * Discovers the mod version the upstream currently expects (spec 6.2).
 * `current()` serves a cached value for refreshMs (default 10 min); `refresh()` forces
 * a fetch and coalesces concurrent callers. A failed refresh keeps the last value.
 */
export class ModVersionSource {
  private version: string | null
  private fetchedAt: number | null = null
  private inflight: Promise<string> | null = null

  constructor(private readonly opts: ModVersionSourceOptions) {
    this.version = opts.override ?? null
  }

  private now(): number {
    return (this.opts.now ?? Date.now)()
  }

  async current(): Promise<string> {
    if (this.opts.override) return this.opts.override
    const refreshMs = this.opts.refreshMs ?? 600_000
    if (this.version && this.fetchedAt !== null && this.now() - this.fetchedAt < refreshMs) {
      return this.version
    }
    try {
      return await this.refresh()
    } catch (err) {
      if (this.version) return this.version
      throw err
    }
  }

  refresh(): Promise<string> {
    if (this.opts.override) return Promise.resolve(this.opts.override)
    if (this.inflight) return this.inflight
    this.inflight = (async () => {
      try {
        const f = this.opts.fetchImpl ?? fetch
        const res = await f(`${this.opts.baseUrl}/api/v1/mod-version`, {
          headers: { 'User-Agent': this.opts.userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000),
        })
        if (!res.ok) throw new Error(`mod-version responded ${res.status}`)
        const body = (await res.json()) as { version?: string; min_version?: string }
        const v = body.version || body.min_version
        if (!v) throw new Error('mod-version: body has no version')
        this.version = v
        this.fetchedAt = this.now()
        return v
      } finally {
        this.inflight = null
      }
    })()
    return this.inflight
  }

  state(): VersionState {
    if (this.opts.override) return { version: this.opts.override, fetched_at: null, source: 'override' }
    if (this.version) {
      return {
        version: this.version,
        fetched_at: this.fetchedAt === null ? null : new Date(this.fetchedAt).toISOString(),
        source: 'discovered',
      }
    }
    return { version: null, fetched_at: null, source: 'none' }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/version.test.ts` — expected PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/version.ts tests/server/version.test.ts
git commit -m "Add mod version discovery"
```

---

### Task 5: Upstream client

**Files:**
- Create: `src/server/upstream.ts`
- Create: `tests/server/helpers/fakeUpstream.ts`
- Test: `tests/server/upstream.test.ts`

**Interfaces:**
- Produces: `class Upstream` with `getJson<T>(path: string, query?: Query): Promise<T>` and `buildUrl(path, query)`; `class UpstreamError extends Error { status: number; path: string; body: unknown }`; `type Query = Record<string, string | number | boolean | undefined>`; `interface UpstreamOptions { baseUrl; userAgent; internalKey?; version: ModVersionSource; fetchImpl?; timeoutMs?; maxConcurrent? }`.
- Produces (test helper): `fakeUpstream(map)` returning `{ fetchImpl, calls, map }` and `json(body, status)`.

- [ ] **Step 1: Write the fake upstream helper**

`tests/server/helpers/fakeUpstream.ts`:

```ts
import { vi } from 'vitest'

export type Responder = () => Response | Promise<Response>
export type RouteMap = Record<string, unknown | Responder>

export interface Call {
  url: URL
  headers: Record<string, string>
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * A fetch() stand-in keyed by upstream path (relative to /api/v1).
 * Values are JSON bodies, or functions returning a Response for status/latency control.
 */
export function fakeUpstream(map: RouteMap) {
  const calls: Call[] = []
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v))
    calls.push({ url, headers })
    const key = url.pathname.replace(/^\/api\/v1/, '')
    if (!(key in map)) return json({ detail: `fake upstream: no route ${key}` }, 404)
    const hit = map[key]
    if (typeof hit === 'function') return await (hit as Responder)()
    return json(hit)
  }) as unknown as typeof fetch
  return { fetchImpl, calls, map }
}

/** A promise you resolve by hand, for concurrency tests. */
export function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
```

- [ ] **Step 2: Write the failing test**

`tests/server/upstream.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Upstream, UpstreamError } from '../../src/server/upstream'
import { ModVersionSource } from '../../src/server/version'
import { NotAllowedError } from '../../src/server/allowlist'
import { fakeUpstream, json, deferred } from './helpers/fakeUpstream'

function make(map: Parameters<typeof fakeUpstream>[0], opts: Partial<ConstructorParameters<typeof Upstream>[0]> = {}) {
  const fake = fakeUpstream({ '/mod-version': { version: '1.40.3', min_version: '1.40.3' }, ...map })
  const version = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'scr-hub/test', fetchImpl: fake.fetchImpl })
  const up = new Upstream({ baseUrl: 'https://up.test', userAgent: 'scr-hub/test', version, fetchImpl: fake.fetchImpl, ...opts })
  return { up, fake, version }
}

describe('Upstream', () => {
  it('builds URLs under /api/v1 and encodes query values, skipping undefined', () => {
    const { up } = make({})
    expect(up.buildUrl('/leaderboard', { limit: 500, include_inactive: undefined, role: 'solo' })).toBe(
      'https://up.test/api/v1/leaderboard?limit=500&role=solo',
    )
  })

  it('sends X-Mod-Version and User-Agent in community mode', async () => {
    const { up, fake } = make({ '/queue/count': { searching: 1, total: 1, online: 2 } })
    const body = await up.getJson<{ searching: number }>('/queue/count')
    expect(body.searching).toBe(1)
    const call = fake.calls.find((c) => c.url.pathname === '/api/v1/queue/count')!
    expect(call.headers['x-mod-version']).toBe('1.40.3')
    expect(call.headers['user-agent']).toBe('scr-hub/test')
    expect(call.headers['x-internal-key']).toBeUndefined()
  })

  it('sends X-Internal-Key instead of X-Mod-Version in hosted mode', async () => {
    const { up, fake } = make({ '/queue/count': { searching: 0 } }, { internalKey: 'k' })
    await up.getJson('/queue/count')
    const call = fake.calls.find((c) => c.url.pathname === '/api/v1/queue/count')!
    expect(call.headers['x-internal-key']).toBe('k')
    expect(call.headers['x-mod-version']).toBeUndefined()
    expect(fake.calls.some((c) => c.url.pathname === '/api/v1/mod-version')).toBe(false)
  })

  it('refuses paths that are not allowlisted before touching the network', async () => {
    const { up, fake } = make({})
    await expect(up.getJson('/admin/actions')).rejects.toThrow(NotAllowedError)
    expect(fake.calls.length).toBe(0)
  })

  it('on 426 refreshes the version and retries exactly once', async () => {
    let versionCalls = 0
    let lbCalls = 0
    const { up, fake } = make({
      '/mod-version': () => json({ version: versionCalls++ === 0 ? '1.40.3' : '1.41.0' }),
      '/leaderboard': () => (lbCalls++ === 0 ? json({ error: 'outdated', required: '1.41.0' }, 426) : json({ entries: [] })),
    })
    const body = await up.getJson<{ entries: unknown[] }>('/leaderboard')
    expect(body.entries).toEqual([])
    const lb = fake.calls.filter((c) => c.url.pathname === '/api/v1/leaderboard')
    expect(lb.length).toBe(2)
    expect(lb[1].headers['x-mod-version']).toBe('1.41.0')
  })

  it('throws UpstreamError with the status for non-2xx responses (after the single 426 retry)', async () => {
    const { up } = make({ '/leaderboard': () => json({ error: 'outdated' }, 426) })
    await expect(up.getJson('/leaderboard')).rejects.toMatchObject({ status: 426, path: '/leaderboard' })
    const { up: up2 } = make({ '/players/search': () => json({ detail: 'nope' }, 404) })
    const err = await up2.getJson('/players/search').catch((e) => e)
    expect(err).toBeInstanceOf(UpstreamError)
    expect(err.status).toBe(404)
  })

  it('never has more than maxConcurrent requests in flight', async () => {
    let inFlight = 0
    let peak = 0
    const gate = deferred<void>()
    const { up } = make(
      {
        '/queue/count': async () => {
          inFlight++
          peak = Math.max(peak, inFlight)
          await gate.promise
          inFlight--
          return json({ searching: 0 })
        },
      },
      { maxConcurrent: 3 },
    )
    const all = Promise.all(Array.from({ length: 10 }, () => up.getJson('/queue/count')))
    await new Promise((r) => setTimeout(r, 10))
    expect(peak).toBe(3)
    gate.resolve()
    await all
    expect(peak).toBe(3)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/server/upstream.test.ts` — expected FAIL (module not found).

- [ ] **Step 4: Write `src/server/upstream.ts`**

```ts
import { assertAllowed } from './allowlist'
import type { ModVersionSource } from './version'

export type Query = Record<string, string | number | boolean | undefined>

export class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown = undefined,
  ) {
    super(`upstream responded ${status} for ${path}`)
    this.name = 'UpstreamError'
  }
}

export interface UpstreamOptions {
  baseUrl: string
  userAgent: string
  internalKey?: string
  version: ModVersionSource
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxConcurrent?: number
}

/** Allowlisted, header-stamped, concurrency-capped JSON client for Sid's API (spec 6.2). */
export class Upstream {
  private active = 0
  private readonly waiters: Array<() => void> = []

  constructor(private readonly opts: UpstreamOptions) {}

  buildUrl(path: string, query?: Query): string {
    assertAllowed(path)
    const url = new URL(`${this.opts.baseUrl}/api/v1${path}`)
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
    return url.toString()
  }

  async getJson<T>(path: string, query?: Query): Promise<T> {
    const url = this.buildUrl(path, query)
    await this.acquire()
    try {
      let res = await this.doFetch(url)
      if (res.status === 426 && !this.opts.internalKey) {
        await this.opts.version.refresh()
        res = await this.doFetch(url)
      }
      if (!res.ok) {
        let body: unknown
        try {
          body = await res.json()
        } catch {
          body = undefined
        }
        throw new UpstreamError(res.status, path, body)
      }
      return (await res.json()) as T
    } finally {
      this.release()
    }
  }

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'User-Agent': this.opts.userAgent, Accept: 'application/json' }
    if (this.opts.internalKey) h['X-Internal-Key'] = this.opts.internalKey
    else h['X-Mod-Version'] = await this.opts.version.current()
    return h
  }

  private async doFetch(url: string): Promise<Response> {
    const f = this.opts.fetchImpl ?? fetch
    return f(url, { headers: await this.headers(), signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) })
  }

  private acquire(): Promise<void> {
    const max = this.opts.maxConcurrent ?? 8
    if (this.active < max) {
      this.active++
      return Promise.resolve()
    }
    return new Promise((resolve) =>
      this.waiters.push(() => {
        this.active++
        resolve()
      }),
    )
  }

  private release(): void {
    this.active--
    const next = this.waiters.shift()
    if (next) next()
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/server/upstream.test.ts` — expected PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/upstream.ts tests/server/upstream.test.ts tests/server/helpers/fakeUpstream.ts
git commit -m "Add allowlisted upstream client with version retry and concurrency cap"
```

---

### Task 6: Cache with stale-while-revalidate, single-flight and stale-on-error

**Files:**
- Create: `src/server/cache.ts`
- Test: `tests/server/cache.test.ts`

**Interfaces:**
- Produces: `interface CacheEntry<T> { value: T; fetched_at: number }`, `interface CacheStore { get, set, size }`, `class MemoryCacheStore`, `interface TtlSpec { ttlMs; staleMs }`, `const TTL = { LIVE, BOARD, RESULTS, PLAYER, REF }`, `interface CachedResult<T> { value; fetched_at; stale }`, `class Cache { get<T>(key, spec, loader, background?): Promise<CachedResult<T>>; size(); defaultBackground }`.

- [ ] **Step 1: Write the failing test**

`tests/server/cache.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { Cache, MemoryCacheStore, TTL } from '../../src/server/cache'
import { deferred } from './helpers/fakeUpstream'

const SPEC = { ttlMs: 10_000, staleMs: 60_000 }

function make() {
  let now = 1_000_000
  const cache = new Cache(new MemoryCacheStore(), () => now)
  return { cache, tick: (ms: number) => (now += ms), now: () => now }
}

describe('Cache', () => {
  it('loads once and serves fresh within the TTL', async () => {
    const { cache, tick } = make()
    const loader = vi.fn(async () => ({ n: 1 }))
    const a = await cache.get('k', SPEC, loader)
    tick(9_999)
    const b = await cache.get('k', SPEC, loader)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(a).toMatchObject({ value: { n: 1 }, stale: false })
    expect(b).toMatchObject({ value: { n: 1 }, stale: false, fetched_at: 1_000_000 })
  })

  it('serves stale immediately inside the stale window and refreshes in the background', async () => {
    const { cache, tick } = make()
    let n = 0
    const loader = vi.fn(async () => ({ n: ++n }))
    const bg: Promise<unknown>[] = []
    await cache.get('k', SPEC, loader)
    tick(20_000)
    const r = await cache.get('k', SPEC, loader, (p) => bg.push(p))
    expect(r).toMatchObject({ value: { n: 1 }, stale: true })
    expect(bg.length).toBe(1)
    await Promise.all(bg)
    const r2 = await cache.get('k', SPEC, loader)
    expect(r2).toMatchObject({ value: { n: 2 }, stale: false })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent misses into one load', async () => {
    const { cache } = make()
    const gate = deferred<{ n: number }>()
    const loader = vi.fn(() => gate.promise)
    const p1 = cache.get('k', SPEC, loader)
    const p2 = cache.get('k', SPEC, loader)
    gate.resolve({ n: 7 })
    const [a, b] = await Promise.all([p1, p2])
    expect(loader).toHaveBeenCalledTimes(1)
    expect(a.value).toEqual({ n: 7 })
    expect(b.value).toEqual({ n: 7 })
  })

  it('serves stale beyond the stale window when the loader fails, and rejects with nothing cached', async () => {
    const { cache, tick } = make()
    const good = vi.fn(async () => ({ n: 1 }))
    await cache.get('k', SPEC, good)
    tick(500_000)
    const bad = vi.fn(async () => {
      throw new Error('upstream down')
    })
    const r = await cache.get('k', SPEC, bad)
    expect(r).toMatchObject({ value: { n: 1 }, stale: true, fetched_at: 1_000_000 })
    await expect(cache.get('other', SPEC, bad)).rejects.toThrow('upstream down')
  })

  it('does not let a failed background refresh reject the caller', async () => {
    const { cache, tick } = make()
    await cache.get('k', SPEC, async () => ({ n: 1 }))
    tick(20_000)
    const r = await cache.get('k', SPEC, async () => {
      throw new Error('boom')
    })
    expect(r.stale).toBe(true)
    await new Promise((res) => setTimeout(res, 0))
    expect(cache.size()).toBe(1)
  })

  it('MemoryCacheStore evicts the least recently used entry past max', async () => {
    const store = new MemoryCacheStore(2)
    await store.set('a', { value: 1, fetched_at: 0 })
    await store.set('b', { value: 2, fetched_at: 0 })
    await store.get('a')
    await store.set('c', { value: 3, fetched_at: 0 })
    expect(await store.get('b')).toBeUndefined()
    expect((await store.get('a'))?.value).toBe(1)
    expect(store.size()).toBe(2)
  })

  it('exports the spec TTLs', () => {
    expect(TTL.LIVE).toEqual({ ttlMs: 10_000, staleMs: 60_000 })
    expect(TTL.BOARD).toEqual({ ttlMs: 30_000, staleMs: 120_000 })
    expect(TTL.RESULTS).toEqual({ ttlMs: 20_000, staleMs: 120_000 })
    expect(TTL.PLAYER).toEqual({ ttlMs: 60_000, staleMs: 300_000 })
    expect(TTL.REF).toEqual({ ttlMs: 600_000, staleMs: 3_600_000 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/cache.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Write `src/server/cache.ts`**

```ts
export interface CacheEntry<T> {
  value: T
  fetched_at: number // epoch ms
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>
  size(): number
}

/** LRU in-memory store. Node uses it directly; the Worker layers the Cache API on top. */
export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheEntry<unknown>>()

  constructor(private readonly max = 1000) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const e = this.map.get(key) as CacheEntry<T> | undefined
    if (e) {
      this.map.delete(key)
      this.map.set(key, e)
    }
    return e
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.map.delete(key)
    this.map.set(key, entry)
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  size(): number {
    return this.map.size
  }
}

export interface TtlSpec {
  ttlMs: number
  staleMs: number
}

/** Spec 6.1 cache classes. */
export const TTL = {
  LIVE: { ttlMs: 10_000, staleMs: 60_000 },
  BOARD: { ttlMs: 30_000, staleMs: 120_000 },
  RESULTS: { ttlMs: 20_000, staleMs: 120_000 },
  PLAYER: { ttlMs: 60_000, staleMs: 300_000 },
  REF: { ttlMs: 600_000, staleMs: 3_600_000 },
} as const satisfies Record<string, TtlSpec>

export interface CachedResult<T> {
  value: T
  fetched_at: number
  stale: boolean
}

export type Background = (p: Promise<unknown>) => void

/**
 * Fresh within ttl; stale-while-revalidate within ttl+stale; single-flight loads;
 * stale-on-error at any age (spec 6.3).
 */
export class Cache {
  private readonly inflight = new Map<string, Promise<CacheEntry<unknown>>>()
  /** Used when a caller passes no `background`. Swallows rejections. */
  defaultBackground: Background = (p) => {
    p.catch(() => {})
  }

  constructor(
    private readonly store: CacheStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async get<T>(
    key: string,
    spec: TtlSpec,
    loader: () => Promise<T>,
    background: Background = this.defaultBackground,
  ): Promise<CachedResult<T>> {
    const entry = await this.store.get<T>(key)
    const age = entry ? this.now() - entry.fetched_at : Number.POSITIVE_INFINITY
    if (entry && age < spec.ttlMs) {
      return { value: entry.value, fetched_at: entry.fetched_at, stale: false }
    }
    if (entry && age < spec.ttlMs + spec.staleMs) {
      background(this.refresh(key, loader).catch(() => undefined))
      return { value: entry.value, fetched_at: entry.fetched_at, stale: true }
    }
    try {
      const fresh = await this.refresh(key, loader)
      return { value: fresh.value, fetched_at: fresh.fetched_at, stale: false }
    } catch (err) {
      if (entry) return { value: entry.value, fetched_at: entry.fetched_at, stale: true }
      throw err
    }
  }

  private refresh<T>(key: string, loader: () => Promise<T>): Promise<CacheEntry<T>> {
    const existing = this.inflight.get(key) as Promise<CacheEntry<T>> | undefined
    if (existing) return existing
    const p = (async () => {
      try {
        const value = await loader()
        const entry: CacheEntry<T> = { value, fetched_at: this.now() }
        await this.store.set(key, entry)
        return entry
      } finally {
        this.inflight.delete(key)
      }
    })()
    this.inflight.set(key, p as Promise<CacheEntry<unknown>>)
    return p
  }

  size(): number {
    return this.store.size()
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/cache.test.ts` — expected PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/cache.ts tests/server/cache.test.ts
git commit -m "Add cache with stale-while-revalidate, single-flight and stale-on-error"
```

---

### Task 7: Privacy masking and match slimming

**Files:**
- Create: `src/shared/privacy.ts`
- Test: `tests/server/privacy.test.ts`

**Interfaces:**
- Produces: `maskProfile(p)`, `maskRecentSeries(s)`, `maskChatMessage(m)`, `slimMatch(m)` — all pure, all return new objects typed `Record<string, unknown>` (routes cast to the hub types).

- [ ] **Step 1: Write the failing test**

`tests/server/privacy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { maskProfile, maskRecentSeries, maskChatMessage, slimMatch } from '../../src/shared/privacy'

const base = {
  steam_id: '76561199311926326',
  display_name: 'NotNic',
  discord_id: '1299197810780143656',
  discord_username: 'ntnic',
  discord_display_name: 'Nic',
  show_discord: true,
  gold_earned: 31818,
  gold_spent: 31445,
  bet_gold_net: -200,
  hide_gold: false,
  appear_offline: false,
  rating: 1101.8,
}

describe('maskProfile', () => {
  it('always removes discord_id, discord_username, appear_offline and hide_gold', () => {
    const m = maskProfile(base)
    expect(m).not.toHaveProperty('discord_id')
    expect(m).not.toHaveProperty('discord_username')
    expect(m).not.toHaveProperty('appear_offline')
    expect(m).not.toHaveProperty('hide_gold')
    expect(m.rating).toBe(1101.8)
  })

  it('keeps discord_display_name only when show_discord is true', () => {
    expect(maskProfile(base).discord_display_name).toBe('Nic')
    expect(maskProfile({ ...base, show_discord: false })).not.toHaveProperty('discord_display_name')
  })

  it('removes gold fields when hide_gold is true and reports gold_hidden', () => {
    const shown = maskProfile(base)
    expect(shown.gold_earned).toBe(31818)
    expect(shown.gold_hidden).toBe(false)
    const hidden = maskProfile({ ...base, hide_gold: true })
    expect(hidden).not.toHaveProperty('gold_earned')
    expect(hidden).not.toHaveProperty('gold_spent')
    expect(hidden).not.toHaveProperty('bet_gold_net')
    expect(hidden.gold_hidden).toBe(true)
  })

  it('does not mutate its input', () => {
    const copy = { ...base }
    maskProfile(copy)
    expect(copy).toEqual(base)
  })
})

describe('maskRecentSeries / maskChatMessage', () => {
  it('drops the discord ids and nothing else', () => {
    const s = maskRecentSeries({ series_id: 'x', p1_discord_id: '1', p2_discord_id: null, p1_name: 'A' })
    expect(s).toEqual({ series_id: 'x', p1_name: 'A' })
    const m = maskChatMessage({ id: 1, discord_id: '2', message: 'hi' })
    expect(m).toEqual({ id: 1, message: 'hi' })
  })
})

describe('slimMatch', () => {
  it('removes timeline, end_stats and point_times fields and keeps the rest', () => {
    const slim = slimMatch({
      match_id: 'm',
      won: true,
      point_timeline: '1:0,1:1',
      player_fps_timeline: '300,299',
      opp_ping_timeline: '50,51',
      player_damage_timeline: '1,2',
      point_times: '3,7',
      player_end_stats: '1|2|3',
      opp_end_stats: '4|5|6',
      cards_picked: [{ card_name: 'Grow' }],
    })
    expect(slim).toEqual({ match_id: 'm', won: true, cards_picked: [{ card_name: 'Grow' }] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/privacy.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Write `src/shared/privacy.ts`**

```ts
// Spec 6.4. Pure functions; the server applies them before any profile-shaped
// object leaves, so the frontend never receives private fields.

type Obj = Record<string, unknown>

const PROFILE_ALWAYS_DROP = ['discord_id', 'discord_username', 'appear_offline', 'hide_gold'] as const
const PROFILE_GOLD_FIELDS = ['gold_earned', 'gold_spent', 'bet_gold_net'] as const

export function maskProfile(p: Obj): Obj {
  const out: Obj = { ...p }
  const hideGold = p.hide_gold === true
  const showDiscord = p.show_discord === true
  for (const k of PROFILE_ALWAYS_DROP) delete out[k]
  if (!showDiscord) delete out.discord_display_name
  if (hideGold) for (const k of PROFILE_GOLD_FIELDS) delete out[k]
  out.gold_hidden = hideGold
  return out
}

export function maskRecentSeries(s: Obj): Obj {
  const out: Obj = { ...s }
  delete out.p1_discord_id
  delete out.p2_discord_id
  return out
}

export function maskChatMessage(m: Obj): Obj {
  const out: Obj = { ...m }
  delete out.discord_id
  return out
}

const SLIM_DROP = /(_timeline|_timelines|_end_stats|point_times)$/

/** Drops the per-second telemetry strings that make a match row several KB. */
export function slimMatch(m: Obj): Obj {
  const out: Obj = {}
  for (const [k, v] of Object.entries(m)) if (!SLIM_DROP.test(k)) out[k] = v
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/privacy.test.ts` — expected PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/privacy.ts tests/server/privacy.test.ts
git commit -m "Add privacy masking and match slimming"
```

---

### Task 8: Fixture fetch and the capture script

**Files:**
- Create: `src/server/fixtures.ts`, `scripts/capture-fixtures.mjs`
- Create (generated): `fixtures/*.json`
- Test: `tests/server/fixtures.test.ts`

**Interfaces:**
- Produces: `fixtureNameFor(urlPath: string): string` and `createFixtureFetch(dir: string): typeof fetch` (Node only; reads `<dir>/<name>.json`). Fixture names: strip `/api/v1/`, replace any all-digit segment with `ID`, any UUID segment with `UUID`, join segments with `__`. Query strings are ignored.

- [ ] **Step 1: Write the failing test**

`tests/server/fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fixtureNameFor, createFixtureFetch } from '../../src/server/fixtures'

describe('fixtureNameFor', () => {
  it('normalises ids and joins segments', () => {
    expect(fixtureNameFor('/api/v1/leaderboard')).toBe('leaderboard')
    expect(fixtureNameFor('/api/v1/players/76561199311926326/matches')).toBe('players__ID__matches')
    expect(fixtureNameFor('/api/v1/players/76561199311926326/vs/76561198040410653/top-cards')).toBe(
      'players__ID__vs__ID__top-cards',
    )
    expect(fixtureNameFor('/api/v1/players/by-discord/1299197810780143656')).toBe('players__by-discord__ID')
    expect(fixtureNameFor('/api/v1/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket-detail')).toBe(
      'tournaments__UUID__bracket-detail',
    )
    expect(fixtureNameFor('/api/v1/admin/maintenance/status')).toBe('admin__maintenance__status')
  })
})

describe('createFixtureFetch', () => {
  it('serves the JSON file for a known path and 404 for an unknown one', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scr-fixtures-'))
    await writeFile(path.join(dir, 'queue__count.json'), JSON.stringify({ searching: 3, total: 3, online: 9 }))
    const f = createFixtureFetch(dir)
    const ok = await f('https://up.test/api/v1/queue/count?steam_id=1')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ searching: 3, total: 3, online: 9 })
    const missing = await f('https://up.test/api/v1/series/active')
    expect(missing.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/fixtures.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Write `src/server/fixtures.ts`**

```ts
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function fixtureNameFor(urlPath: string): string {
  const p = urlPath.replace(/^\/api\/v1\//, '').replace(/^\/+|\/+$/g, '')
  return p
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) ? 'ID' : UUID_RE.test(seg) ? 'UUID' : seg))
    .join('__')
}

/**
 * A fetch() that answers from `<dir>/<fixtureName>.json` (spec 7.4). Node only.
 * Unknown paths get a 404 with a JSON body so routes degrade the same way as upstream 404s.
 */
export function createFixtureFetch(dir: string): typeof fetch {
  const impl = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    const name = fixtureNameFor(url.pathname)
    try {
      const text = await readFile(path.join(dir, `${name}.json`), 'utf8')
      return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } })
    } catch {
      return new Response(JSON.stringify({ detail: `no fixture ${name}` }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }
  }
  return impl as typeof fetch
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/fixtures.test.ts` — expected PASS (2 tests).

- [ ] **Step 5: Write `scripts/capture-fixtures.mjs`**

This is the only automated code that touches the live API. It scrubs Discord identifiers before writing, so fixtures are safe to commit.

```js
// Capture upstream responses into fixtures/ for demo and test mode (spec 7.4).
// Usage: npm run capture            (uses NotNic + Sid as the sample players)
//        SCR_UPSTREAM_BASE=... SCR_MOD_VERSION=... npm run capture
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = (process.env.SCR_UPSTREAM_BASE || 'https://competitive-rounds.duckdns.org:8444').replace(/\/+$/, '')
const UA = 'scr-hub-capture/0.1 (+https://github.com/NotNic/scr-hub)'
const ME = process.env.SCR_SAMPLE_STEAM_ID || '76561199311926326'
const OPP = process.env.SCR_SAMPLE_OPPONENT_ID || '76561198040410653'
const OUT = path.resolve('fixtures')

async function modVersion() {
  if (process.env.SCR_MOD_VERSION) return process.env.SCR_MOD_VERSION
  const r = await fetch(`${BASE}/api/v1/mod-version`, { headers: { 'User-Agent': UA } })
  const j = await r.json()
  return j.version
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const nameFor = (p) =>
  p.replace(/^\/+|\/+$/g, '').split('/').map((s) => (/^\d+$/.test(s) ? 'ID' : UUID_RE.test(s) ? 'UUID' : s)).join('__')

const DROP_KEYS = /^(p1_|p2_)?discord_id$|^discord_username$/
function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub)
  if (v && typeof v === 'object') {
    const o = {}
    for (const [k, x] of Object.entries(v)) {
      if (DROP_KEYS.test(k)) continue
      o[k] = scrub(x)
    }
    return o
  }
  return v
}

const STATIC = [
  '/mod-version', '/health', '/admin/maintenance/status', '/alerts/active', '/rank-tiers',
  '/leaderboard?limit=500', '/team/leaderboard?limit=500', '/ffa/leaderboard?limit=500', '/ovt/leaderboard?limit=500',
  '/presence/online', '/queue/count', '/team/queue/count', '/queue/recent-joins?seconds=3600',
  '/series/active', '/team/series/active', '/ffa/lobbies', '/spectate/games',
  '/series/recent?minutes=43200&limit=50', '/series/recent-multimode?limit=60',
  '/players/search?q=nic',
  `/players/${ME}?viewer_steam_id=${OPP}`, `/players/${ME}/matches?limit=100`, `/players/${ME}/matches/summary`,
  `/players/${ME}/rating-history`, `/players/${ME}/team-history`, `/players/${ME}/ffa-history`, `/players/${ME}/ovt-history`,
  `/players/${ME}/vs/${OPP}/top-cards`, `/team/players/${ME}/team-stats`,
  '/achievements/definitions', `/achievements/${ME}`,
  '/cards?limit=200&min_picks=5', '/cards/leaders-summary?limit_per_card=5', '/cards/top-pickers?card_name=Poison',
  '/tournaments/current?kind=sync', '/tournaments/history', '/tournaments/history-detail?limit=8',
  `/tournaments/players/${ME}/tournaments`,
  '/chat/recent?limit=50', '/releases/recent?limit=3',
]

async function get(version, p) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    headers: { 'User-Agent': UA, 'X-Mod-Version': version, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text } }
  return { status: r.status, body }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const version = await modVersion()
  const paths = [...STATIC]
  // Bracket detail needs a real tournament id: take the newest completed one.
  const hist = await get(version, '/tournaments/history')
  if (hist.status === 200 && Array.isArray(hist.body) && hist.body[0]) {
    paths.push(`/tournaments/${hist.body[0].tournament_id}/bracket-detail`)
  }
  let ok = 0
  for (const p of paths) {
    const { status, body } = await get(version, p)
    const file = path.join(OUT, `${nameFor(p.split('?')[0])}.json`)
    if (status !== 200) {
      console.log(`skip ${p} -> ${status}`)
      continue
    }
    await writeFile(file, JSON.stringify(scrub(body), null, 2) + '\n')
    ok++
    console.log(`ok   ${p} -> ${path.basename(file)}`)
    await new Promise((r) => setTimeout(r, 150))
  }
  console.log(`\n${ok}/${paths.length} fixtures written to ${OUT} (mod version ${version})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 6: Run the capture once and inspect**

Run: `npm run capture`
Expected: roughly 40 `ok` lines and files under `fixtures/`. Then verify no Discord ids survived:

```bash
grep -rl "discord_id\|discord_username" fixtures/ || echo "clean"
```

Expected: `clean`. Note that `players__ID.json` is NotNic's own profile with `discord_display_name` still present because the live `show_discord` is true; that is public by the player's own choice and the hub masks it at request time anyway.

- [ ] **Step 7: Commit**

```bash
git add src/server/fixtures.ts scripts/capture-fixtures.mjs tests/server/fixtures.test.ts fixtures/
git commit -m "Add fixture mode and the capture script with captured fixtures"
```

---

### Task 9: Route plumbing, `/api/_status` and `/api/meta`

**Files:**
- Create: `src/server/routes/common.ts`, `src/server/routes/meta.ts`, `src/server/routes/status.ts`
- Modify: `src/server/app.ts` (wire `Cache`, `Upstream`, `ModVersionSource`; register route modules)
- Create: `tests/server/helpers/makeApp.ts`
- Test: `tests/server/meta.test.ts`, modify `tests/server/status.test.ts`

**Interfaces:**
- Produces: `interface RouteDeps { env: Env; upstream: Upstream; cache: Cache; version: ModVersionSource }`; `AppDeps = { env; fetchImpl?; store?; now?; discordFetch? }`; `createApp` now returns `{ app, cache, upstream, version, deps }`.
- Produces (common.ts): `ok(c, result, extra?)`, `errorResponse(c, err)`, `backgroundFor(c)`, `loaderFor(d, c)` returning `load<T>(key, spec, path, query?)`, `isSteamId(s)`, `isUuid(s)`, `intParam(c, name, def, min, max)`.
- Produces (test helper): `makeApp(map, envOverrides?)` returning `{ app, fake, deps }` with `SCR_MOD_VERSION_OVERRIDE=1.40.3` and upstream `https://up.test` unless overridden.

- [ ] **Step 1: Write the test helper**

`tests/server/helpers/makeApp.ts`:

```ts
import { createApp } from '../../../src/server/app'
import { parseEnv } from '../../../src/server/env'
import { MemoryCacheStore } from '../../../src/server/cache'
import { fakeUpstream, type RouteMap } from './fakeUpstream'

export function makeApp(map: RouteMap, envOverrides: Record<string, string | undefined> = {}, nowRef?: { now: number }) {
  const fake = fakeUpstream(map)
  const env = parseEnv({ SCR_UPSTREAM_BASE: 'https://up.test', SCR_MOD_VERSION_OVERRIDE: '1.40.3', ...envOverrides })
  const built = createApp({
    env,
    fetchImpl: fake.fetchImpl,
    store: new MemoryCacheStore(),
    now: nowRef ? () => nowRef.now : undefined,
  })
  return { ...built, fake, env }
}
```

- [ ] **Step 2: Write the failing tests**

`tests/server/meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const TIERS = { tiers: [{ floor: 2330, name: 'Grand Master', color: '#F487A9' }, { floor: 0, name: 'Beginner', color: '#BB79EE' }] }
const DEFS = { achievements: { untouchable: { name: 'Untouchable', desc: 'Win 5-0' } } }
const RELEASES = { posts: [{ author: 'Competitive ROUNDS', content: 'v1.40.3', posted_at: '2026-09-09T00:00:00Z' }] }

describe('GET /api/meta', () => {
  it('aggregates tiers, achievement definitions, releases and the version state', async () => {
    const { app } = makeApp({ '/rank-tiers': TIERS, '/achievements/definitions': DEFS, '/releases/recent': RELEASES })
    const res = await app.request('/api/meta')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.rank_tiers).toEqual(TIERS.tiers)
    expect(body.data.achievement_definitions.untouchable.name).toBe('Untouchable')
    expect(body.data.releases[0].content).toBe('v1.40.3')
    expect(body.data.mod_version).toEqual({ version: '1.40.3', min_version: '1.40.3' })
    expect(body.errors).toEqual([])
    expect(typeof body.fetched_at).toBe('string')
    expect(body.stale).toBe(false)
  })

  it('returns what it can when one upstream item fails, naming it in errors', async () => {
    const { app } = makeApp({ '/rank-tiers': TIERS, '/achievements/definitions': () => json({}, 500), '/releases/recent': RELEASES })
    const body = await (await app.request('/api/meta')).json()
    expect(body.data.rank_tiers.length).toBe(2)
    expect(body.data.achievement_definitions).toEqual({})
    expect(body.errors).toEqual(['achievement_definitions'])
  })
})
```

Append to `tests/server/status.test.ts`:

```ts
import { makeApp } from './helpers/makeApp'

describe('GET /api/_status (full)', () => {
  it('reports the version source, cache size and auth flag', async () => {
    const { app } = makeApp({})
    const body = await (await app.request('/api/_status')).json()
    expect(body.upstream.base).toBe('https://up.test')
    expect(body.upstream.version).toMatchObject({ version: '1.40.3', source: 'override' })
    expect(body.cache.size).toBe(0)
    expect(body.auth_enabled).toBe(false)
  })

  it('probes /health only when asked', async () => {
    const { app, fake } = makeApp({ '/health': { status: 'ok' } })
    await app.request('/api/_status')
    expect(fake.calls.length).toBe(0)
    const body = await (await app.request('/api/_status?probe=1')).json()
    expect(body.upstream.reachable).toBe(true)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/server/meta.test.ts tests/server/status.test.ts` — expected FAIL (missing routes / helper imports).

- [ ] **Step 4: Write `src/server/routes/common.ts`**

```ts
import type { Context } from 'hono'
import { NotAllowedError } from '../allowlist'
import { type Background, type Cache, type CachedResult, type TtlSpec } from '../cache'
import type { Env } from '../env'
import { type Query, type Upstream, UpstreamError } from '../upstream'
import type { ModVersionSource } from '../version'

export interface RouteDeps {
  env: Env
  upstream: Upstream
  cache: Cache
  version: ModVersionSource
}

export function envelope<T>(r: CachedResult<T>) {
  return { data: r.value, fetched_at: new Date(r.fetched_at).toISOString(), stale: r.stale }
}

export function ok<T>(c: Context, r: CachedResult<T>, extra: Record<string, unknown> = {}) {
  c.header('Cache-Control', 'public, max-age=5')
  return c.json({ ...envelope(r), ...extra })
}

/** Maps upstream and network failures to hub status codes (spec 11). */
export function errorResponse(c: Context, err: unknown) {
  if (err instanceof UpstreamError) {
    if (err.status === 404 || err.status === 410) return c.json({ error: 'not_found', upstream_status: err.status }, 404)
    if (err.status === 426) {
      return c.json(
        { error: 'upstream_version_gate', detail: 'The site needs an update to talk to the new server version.' },
        503,
      )
    }
    if (err.status === 429) {
      c.header('Retry-After', '10')
      return c.json({ error: 'upstream_rate_limited', retry_after: 10 }, 503)
    }
    if (err.status === 400 || err.status === 422) return c.json({ error: 'bad_request', upstream_status: err.status }, 400)
    return c.json({ error: 'upstream_error', upstream_status: err.status }, 502)
  }
  if (err instanceof NotAllowedError) {
    console.error('[hub] route requested a non-allowlisted path', err.message)
    return c.json({ error: 'internal' }, 500)
  }
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return c.json({ error: 'upstream_timeout' }, 503)
  }
  if (err instanceof TypeError) return c.json({ error: 'upstream_unreachable' }, 503)
  console.error('[hub] unexpected error', err)
  return c.json({ error: 'internal' }, 500)
}

/** On Cloudflare Workers, background refreshes must be attached to the execution context. */
export function backgroundFor(c: Context): Background | undefined {
  try {
    const ctx = c.executionCtx
    return (p) => ctx.waitUntil(p.catch(() => {}))
  } catch {
    return undefined
  }
}

export function loaderFor(d: RouteDeps, c: Context) {
  const bg = backgroundFor(c)
  return <T>(key: string, spec: TtlSpec, path: string, query?: Query) =>
    d.cache.get<T>(key, spec, () => d.upstream.getJson<T>(path, query), bg)
}

export const STEAM_ID_RE = /^\d{17}$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isSteamId(s: string | undefined): s is string {
  return !!s && STEAM_ID_RE.test(s)
}

export function isUuid(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s)
}

export function intParam(c: Context, name: string, def: number, min: number, max: number): number {
  const raw = c.req.query(name)
  if (raw === undefined || raw === '') return def
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

/** Runs several cached loads in parallel; returns values, the oldest fetched_at, stale flag, and failed keys. */
export async function gather<T extends Record<string, Promise<CachedResult<unknown>>>>(jobs: T) {
  const keys = Object.keys(jobs) as Array<keyof T & string>
  const settled = await Promise.allSettled(Object.values(jobs))
  const values: Partial<{ [K in keyof T]: Awaited<T[K]>['value'] }> = {}
  const errors: string[] = []
  let stale = false
  let oldest = Date.now()
  settled.forEach((s, i) => {
    const k = keys[i]
    if (s.status === 'fulfilled') {
      values[k] = s.value.value as never
      stale ||= s.value.stale
      oldest = Math.min(oldest, s.value.fetched_at)
    } else {
      errors.push(k)
    }
  })
  return { values, errors, stale, fetched_at: oldest }
}
```

- [ ] **Step 5: Write `src/server/routes/meta.ts`**

```ts
import type { Hono } from 'hono'
import type { AchievementDefinitions, RankTiersResponse, ReleasesRecent } from '../../shared/api-types'
import type { MetaData } from '../../shared/hub-types'
import { TTL } from '../cache'
import { gather, loaderFor, type RouteDeps } from './common'

export function registerMetaRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/meta', async (c) => {
    const load = loaderFor(d, c)
    const g = await gather({
      rank_tiers: load<RankTiersResponse>('meta:tiers', TTL.REF, '/rank-tiers'),
      achievement_definitions: load<AchievementDefinitions>('meta:achdefs', TTL.REF, '/achievements/definitions'),
      releases: load<ReleasesRecent>('meta:releases', TTL.REF, '/releases/recent', { limit: 3 }),
    })
    const state = d.version.state()
    const data: MetaData = {
      rank_tiers: g.values.rank_tiers?.tiers ?? [],
      achievement_definitions: g.values.achievement_definitions?.achievements ?? {},
      mod_version: state.version ? { version: state.version, min_version: state.version } : null,
      releases: g.values.releases?.posts ?? [],
    }
    c.header('Cache-Control', 'public, max-age=60')
    return c.json({ data, fetched_at: new Date(g.fetched_at).toISOString(), stale: g.stale, errors: g.errors })
  })
}
```

- [ ] **Step 6: Write `src/server/routes/status.ts`**

```ts
import type { Hono } from 'hono'
import type { StatusResponse } from '../../shared/hub-types'
import { modeOf } from '../env'
import type { RouteDeps } from './common'

export function registerStatusRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/_status', async (c) => {
    const body: StatusResponse = {
      mode: modeOf(d.env),
      app_version: d.env.appVersion,
      features: [...d.env.features],
      auth_enabled: !!d.env.discord,
      upstream: { base: d.env.upstreamBase, version: d.version.state() },
      cache: { size: d.cache.size() },
    }
    if (c.req.query('probe') === '1') {
      try {
        await d.upstream.getJson('/health')
        body.upstream.reachable = true
      } catch {
        body.upstream.reachable = false
      }
    }
    c.header('Cache-Control', 'no-store')
    return c.json(body)
  })
}
```

- [ ] **Step 7: Rewrite `src/server/app.ts`**

```ts
import { Hono } from 'hono'
import { Cache, MemoryCacheStore, type CacheStore } from './cache'
import { type Env } from './env'
import { registerMetaRoutes } from './routes/meta'
import { registerStatusRoutes } from './routes/status'
import type { RouteDeps } from './routes/common'
import { Upstream } from './upstream'
import { ModVersionSource } from './version'

export interface AppDeps {
  env: Env
  fetchImpl?: typeof fetch
  store?: CacheStore
  now?: () => number
  /** fetch used for Discord's own API (Task 15); defaults to fetchImpl or global fetch. */
  discordFetch?: typeof fetch
}

export function createApp(deps: AppDeps) {
  const { env } = deps
  const now = deps.now ?? (() => Date.now())
  const version = new ModVersionSource({
    baseUrl: env.upstreamBase,
    userAgent: env.userAgent,
    override: env.modVersionOverride,
    fetchImpl: deps.fetchImpl,
    now,
  })
  const upstream = new Upstream({
    baseUrl: env.upstreamBase,
    userAgent: env.userAgent,
    internalKey: env.internalKey,
    version,
    fetchImpl: deps.fetchImpl,
  })
  const cache = new Cache(deps.store ?? new MemoryCacheStore(), now)
  const routeDeps: RouteDeps = { env, upstream, cache, version }

  const app = env.basePath === '/' ? new Hono() : new Hono().basePath(env.basePath)

  app.notFound((c) =>
    c.req.path.includes('/api/') ? c.json({ error: 'not_found' }, 404) : c.text('Not found', 404),
  )
  app.onError((err, c) => {
    console.error('[hub] unhandled', err)
    return c.json({ error: 'internal' }, 500)
  })

  registerStatusRoutes(app, routeDeps)
  registerMetaRoutes(app, routeDeps)
  // Tasks 10–15 add: registerHomeRoutes, registerBoardRoutes, registerPlayerRoutes,
  // registerTournamentRoutes, registerCardRoutes, registerChatRoutes, registerAuthRoutes.

  return { app, cache, upstream, version, deps: routeDeps }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run` — expected: every test file passes (status, rank, allowlist, version, upstream, cache, privacy, fixtures, meta). Run `npm run typecheck` — expected clean.

- [ ] **Step 9: Commit**

```bash
git add src/server tests/server
git commit -m "Wire cache, upstream and version into the app; add meta and full status routes"
```

---

### Task 10: `/api/home` aggregate

**Files:**
- Create: `src/server/routes/home.ts`
- Modify: `src/server/app.ts` (register)
- Test: `tests/server/home.test.ts`

**Interfaces:**
- Produces: `GET /api/home` returning `HomeEnvelope` (spec 6.1). Each upstream item is cached under its own key (`home:presence`, `home:queue`, `home:team-queue`, `home:series-1v1`, `home:series-2v2`, `home:ffa-lobbies`, `home:spectate`, `results:20`, `home:maintenance`, `home:alerts`).

- [ ] **Step 1: Write the failing test**

`tests/server/home.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const PRESENCE = {
  online_count: 2,
  online: [{ display_name: 'Spirit', steam_id: '76561198984811435', rating: 1868, title: 'Clown', title_color: '#FF6688', minutes_ago: 0 }],
  recent: [{ display_name: 'NotNic', steam_id: '76561199311926326', rating: 1101, title: 'Poisoner', title_color: '#66CC44', minutes_ago: 13 }],
}
const SERIES = {
  series: [{
    series_id: 's1', p1_steam_id: '76561199311926326', p1_name: 'NotNic', p1_rating: 1101, p1_rd: 66, p1_wins: 1, p1_odds: 2.1, p1_bettable: true,
    p2_steam_id: '76561198040410653', p2_name: 'Sid', p2_rating: 2564, p2_rd: 127, p2_wins: 0, p2_odds: 1.05, p2_bettable: false,
    live_p1_points: 1, live_p2_points: 0, bets_locked: true, lock_reason: 'game_in_progress', is_private: false, is_tournament: false,
    tournament_kind: null, tournament_label: '', phase: 'live', started_at: '2026-09-22T10:00:00Z',
  }],
}
const RESULTS = { entries: [{ mode: 'ffa', id: 'm1', ended_at: '2026-09-22T08:25:02Z', left_label: 'Nix', right_label: '3-player FFA', score: '#1 of 3', left_rating_change: 6.7, right_rating_change: null, settings: null, bets: [] }] }

const ALL = {
  '/presence/online': PRESENCE,
  '/queue/count': { searching: 1, total: 1, online: 2 },
  '/team/queue/count': { searching: 4 },
  '/series/active': SERIES,
  '/team/series/active': { series: [] },
  '/ffa/lobbies': { lobbies: [], count: 0 },
  '/spectate/games': { games: [] },
  '/series/recent-multimode': RESULTS,
  '/admin/maintenance/status': { in_maintenance: false },
  '/alerts/active': { rev: 1, alerts: [{ category: 'info', message: 'Server restart at 9pm', expires_at: null }] },
}

describe('GET /api/home', () => {
  it('aggregates every live item into HomeData', async () => {
    const { app, fake } = makeApp(ALL)
    const res = await app.request('/api/home')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toEqual([])
    expect(body.data.presence.online[0].display_name).toBe('Spirit')
    expect(body.data.queue).toEqual({ ranked_searching: 1, team_searching: 4, online: 2 })
    expect(body.data.live.series_1v1[0].p1_name).toBe('NotNic')
    expect(body.data.live.series_2v2).toEqual([])
    expect(body.data.results[0].score).toBe('#1 of 3')
    expect(body.data.maintenance).toBe(false)
    expect(body.data.alerts[0].message).toBe('Server restart at 9pm')
    const upstreamPaths = fake.calls.map((c) => c.url.pathname).sort()
    expect(upstreamPaths).toContain('/api/v1/series/recent-multimode')
    expect(fake.calls.find((c) => c.url.pathname === '/api/v1/series/recent-multimode')!.url.searchParams.get('limit')).toBe('20')
  })

  it('serves the second request from cache without touching upstream', async () => {
    const { app, fake } = makeApp(ALL)
    await app.request('/api/home')
    const n = fake.calls.length
    await app.request('/api/home')
    expect(fake.calls.length).toBe(n)
  })

  it('degrades: a failing item becomes an empty default and is named in errors', async () => {
    const { app } = makeApp({ ...ALL, '/series/active': () => json({ detail: 'boom' }, 500) })
    const body = await (await app.request('/api/home')).json()
    expect(body.data.live.series_1v1).toEqual([])
    expect(body.errors).toEqual(['series_1v1'])
    expect(body.data.presence.online_count).toBe(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/home.test.ts` — expected FAIL (404 from the app: route missing).

- [ ] **Step 3: Write `src/server/routes/home.ts`**

```ts
import type { Hono } from 'hono'
import type {
  ActiveSeriesList,
  ActiveTeamSeriesList,
  AlertsActive,
  FfaLobbies,
  MaintenanceStatus,
  MultimodeRecent,
  PresenceOnline,
  QueueCount,
  SpectateGames,
  TeamQueueCount,
} from '../../shared/api-types'
import type { HomeData } from '../../shared/hub-types'
import { TTL } from '../cache'
import { gather, loaderFor, type RouteDeps } from './common'

export function registerHomeRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/home', async (c) => {
    const load = loaderFor(d, c)
    const g = await gather({
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
    })
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
    c.header('Cache-Control', 'public, max-age=5')
    return c.json({ data, fetched_at: new Date(g.fetched_at).toISOString(), stale: g.stale, errors: g.errors })
  })
}
```

- [ ] **Step 4: Register in `src/server/app.ts`**

Add the import `import { registerHomeRoutes } from './routes/home'` and, directly after `registerMetaRoutes(app, routeDeps)`, the line `registerHomeRoutes(app, routeDeps)`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/server/home.test.ts` — expected PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/home.ts src/server/app.ts tests/server/home.test.ts
git commit -m "Add /api/home aggregate route"
```

---

### Task 11: Leaderboards, results and player search

**Files:**
- Create: `src/server/routes/boards.ts`
- Modify: `src/server/app.ts` (register; boards must be registered before the player routes of Task 12 so `/api/players/search` wins over `/api/players/:id`)
- Test: `tests/server/boards.test.ts`

**Interfaces:**
- Produces: `GET /api/leaderboard/:mode` (`1v1`, `2v2`, `ffa`, `1v2`, `1v2-solo`, `1v2-duo`; `?inactive=1`), `GET /api/results?limit=`, `GET /api/results/1v1?limit=` (masked recent series), `GET /api/players/search?q=`.

- [ ] **Step 1: Write the failing test**

`tests/server/boards.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'

const LB = { entries: [{ rank: 1, steam_id: '76561198040410653', display_name: 'Sid', is_online: false, inactive: false, rating: 2564, rd: 127, total_matches: 405, wins: 400, losses: 5, win_rate: 0.9877, level: 71, gold: -1, title: 'FFA 1st Place', title_color: '#FFD700', rank_name: 'Grand Master IV', rank_color: '#E52745' }], total_players: 97, last_updated: '2026-09-22T12:54:34Z' }

describe('leaderboards', () => {
  it('maps modes to upstream boards with limit=500', async () => {
    const { app, fake } = makeApp({ '/leaderboard': LB, '/team/leaderboard': { entries: [], total_players: 0, last_updated: '' }, '/ffa/leaderboard': { entries: [], total_players: 0, last_updated: '', is_ranked: true }, '/ovt/leaderboard': { entries: [], total_players: 0, last_updated: '', is_ranked: false } })
    const body = await (await app.request('/api/leaderboard/1v1')).json()
    expect(body.data.entries[0].rank_name).toBe('Grand Master IV')
    expect(body.data.entries[0].gold).toBe(-1)
    for (const mode of ['2v2', 'ffa', '1v2', '1v2-solo', '1v2-duo']) expect((await app.request(`/api/leaderboard/${mode}`)).status).toBe(200)
    const q = (p: string) => fake.calls.filter((c) => c.url.pathname === `/api/v1${p}`).map((c) => Object.fromEntries(c.url.searchParams))
    expect(q('/leaderboard')[0]).toEqual({ limit: '500' })
    expect(q('/ovt/leaderboard').map((x) => x.role)).toEqual(['combined', 'solo', 'duo'])
  })

  it('passes include_inactive only when asked and caches per variant', async () => {
    const { app, fake } = makeApp({ '/leaderboard': LB })
    await app.request('/api/leaderboard/1v1')
    await app.request('/api/leaderboard/1v1?inactive=1')
    await app.request('/api/leaderboard/1v1?inactive=1')
    const calls = fake.calls.filter((c) => c.url.pathname === '/api/v1/leaderboard')
    expect(calls.length).toBe(2)
    expect(calls[0].url.searchParams.get('include_inactive')).toBeNull()
    expect(calls[1].url.searchParams.get('include_inactive')).toBe('true')
  })

  it('rejects an unknown mode with 404 and the list of modes', async () => {
    const { app } = makeApp({})
    const res = await app.request('/api/leaderboard/3v3')
    expect(res.status).toBe(404)
    expect((await res.json()).modes).toContain('1v1')
  })
})

describe('results', () => {
  it('proxies the multimode feed with a bounded limit', async () => {
    const { app, fake } = makeApp({ '/series/recent-multimode': { entries: [] } })
    expect((await app.request('/api/results?limit=999')).status).toBe(200)
    expect(fake.calls[0].url.searchParams.get('limit')).toBe('200')
  })

  it('masks discord ids out of recent 1v1 series', async () => {
    const { app } = makeApp({ '/series/recent': { series: [{ series_id: 's', p1_name: 'A', p1_discord_id: '1', p2_name: 'B', p2_discord_id: null, bets: [] }] } })
    const body = await (await app.request('/api/results/1v1')).json()
    expect(body.data.series[0]).toEqual({ series_id: 's', p1_name: 'A', p2_name: 'B', bets: [] })
  })
})

describe('player search', () => {
  it('requires q of 1-40 chars and forwards limit=8', async () => {
    const { app, fake } = makeApp({ '/players/search': { results: [{ steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101 }] } })
    expect((await app.request('/api/players/search')).status).toBe(400)
    expect((await app.request('/api/players/search?q=' + 'x'.repeat(41))).status).toBe(400)
    const body = await (await app.request('/api/players/search?q=nic')).json()
    expect(body.data.results[0].display_name).toBe('NotNic')
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ q: 'nic', limit: '8' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/boards.test.ts` — expected FAIL.

- [ ] **Step 3: Write `src/server/routes/boards.ts`**

```ts
import type { Hono } from 'hono'
import type { RecentSeriesList } from '../../shared/api-types'
import { maskRecentSeries } from '../../shared/privacy'
import { TTL } from '../cache'
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

export function registerBoardRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/leaderboard/:mode', async (c) => {
    const mode = c.req.param('mode')
    const spec = MODES[mode]
    if (!spec) return c.json({ error: 'unknown_mode', modes: Object.keys(MODES) }, 404)
    const inactive = c.req.query('inactive') === '1'
    try {
      const r = await loaderFor(d, c)(`lb:${mode}:${inactive ? 1 : 0}`, TTL.BOARD, spec.path, {
        ...spec.query,
        include_inactive: inactive ? true : undefined,
      })
      return ok(c, r)
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/results', async (c) => {
    const limit = intParam(c, 'limit', 60, 1, 200)
    try {
      return ok(c, await loaderFor(d, c)(`results:${limit}`, TTL.RESULTS, '/series/recent-multimode', { limit }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/results/1v1', async (c) => {
    const limit = intParam(c, 'limit', 50, 1, 200)
    try {
      const r = await loaderFor(d, c)<RecentSeriesList>(`results:1v1:${limit}`, TTL.RESULTS, '/series/recent', {
        minutes: 43200,
        limit,
      })
      const series = (r.value.series ?? []).map((s) => maskRecentSeries(s as unknown as Record<string, unknown>))
      return ok(c, { ...r, value: { series } })
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    if (q.length < 1 || q.length > 40) return c.json({ error: 'bad_query', detail: 'q must be 1-40 characters' }, 400)
    try {
      return ok(c, await loaderFor(d, c)(`search:${q.toLowerCase()}`, TTL.BOARD, '/players/search', { q, limit: 8 }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
```

- [ ] **Step 4: Register in `src/server/app.ts`**

Add `import { registerBoardRoutes } from './routes/boards'` and the line `registerBoardRoutes(app, routeDeps)` after `registerHomeRoutes(app, routeDeps)`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/server/boards.test.ts` — expected PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/boards.ts src/server/app.ts tests/server/boards.test.ts
git commit -m "Add leaderboard, results and player search routes"
```

---

### Task 12: Player routes

**Files:**
- Create: `src/server/routes/players.ts`
- Modify: `src/server/app.ts` (register after boards)
- Test: `tests/server/players.test.ts`

**Interfaces:**
- Produces: `GET /api/players/:id?me=` (masked `HubProfile`), `GET /api/players/:id/:sub` for `matches` (`?limit=&offset=`, slimmed), `matches-summary`, `rating-history`, `team-history`, `ffa-history`, `ovt-history`, `team-stats`, `achievements`, `tournaments`; `GET /api/players/:id/vs/:opp` (top cards head-to-head).

- [ ] **Step 1: Write the failing test**

`tests/server/players.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const ME = '76561199311926326'
const SID = '76561198040410653'
const PROFILE = {
  steam_id: ME, display_name: 'NotNic', rating: 1101.8, discord_id: '1299', discord_username: 'ntnic', discord_display_name: 'Nic',
  show_discord: false, gold_earned: 31818, gold_spent: 31445, hide_gold: true, appear_offline: true,
  h2h_ranked_wins: 0, h2h_ranked_losses: 8, recent_form: [], top_cards: [],
}
const MATCH = { match_id: 'm', opponent_name: 'TechTara', won: true, point_timeline: '1:0', player_fps_timeline: '300', player_end_stats: '1|2', cards_picked: [] }

describe('GET /api/players/:id', () => {
  it('returns the masked profile and forwards the viewer', async () => {
    const { app, fake } = makeApp({ [`/players/${ME}`]: PROFILE })
    const body = await (await app.request(`/api/players/${ME}?me=${SID}`)).json()
    expect(body.data.display_name).toBe('NotNic')
    expect(body.data).not.toHaveProperty('discord_id')
    expect(body.data).not.toHaveProperty('discord_username')
    expect(body.data).not.toHaveProperty('discord_display_name')
    expect(body.data).not.toHaveProperty('gold_earned')
    expect(body.data).not.toHaveProperty('appear_offline')
    expect(body.data).not.toHaveProperty('hide_gold')
    expect(body.data.gold_hidden).toBe(true)
    expect(body.data.h2h_ranked_losses).toBe(8)
    expect(fake.calls[0].url.searchParams.get('viewer_steam_id')).toBe(SID)
  })

  it('ignores a viewer equal to the player and rejects bad ids', async () => {
    const { app, fake } = makeApp({ [`/players/${ME}`]: PROFILE })
    await app.request(`/api/players/${ME}?me=${ME}`)
    expect(fake.calls[0].url.searchParams.get('viewer_steam_id')).toBeNull()
    expect((await app.request('/api/players/notanid')).status).toBe(400)
  })

  it('maps upstream 404 to 404', async () => {
    const { app } = makeApp({ [`/players/${ME}`]: () => json({ detail: 'Player not found' }, 404) })
    const res = await app.request(`/api/players/${ME}`)
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('not_found')
  })
})

describe('GET /api/players/:id/:sub', () => {
  it('slims match rows and bounds limit/offset', async () => {
    const { app, fake } = makeApp({ [`/players/${ME}/matches`]: [MATCH] })
    const body = await (await app.request(`/api/players/${ME}/matches?limit=5000&offset=-3`)).json()
    expect(body.data[0]).toEqual({ match_id: 'm', opponent_name: 'TechTara', won: true, cards_picked: [] })
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ limit: '200', offset: '0' })
  })

  it.each([
    ['matches-summary', `/players/${ME}/matches/summary`],
    ['rating-history', `/players/${ME}/rating-history`],
    ['team-history', `/players/${ME}/team-history`],
    ['ffa-history', `/players/${ME}/ffa-history`],
    ['ovt-history', `/players/${ME}/ovt-history`],
    ['team-stats', `/team/players/${ME}/team-stats`],
    ['achievements', `/achievements/${ME}`],
    ['tournaments', `/tournaments/players/${ME}/tournaments`],
  ])('maps %s to %s', async (sub, upstreamPath) => {
    const { app, fake } = makeApp({ [upstreamPath]: { ok: sub } })
    const body = await (await app.request(`/api/players/${ME}/${sub}`)).json()
    expect(body.data).toEqual({ ok: sub })
    expect(fake.calls[0].url.pathname).toBe(`/api/v1${upstreamPath}`)
  })

  it('returns 404 for an unknown sub-resource and never proxies private ones', async () => {
    const { app, fake } = makeApp({})
    for (const sub of ['inventory', 'bets', 'blocks', 'gold-sources', 'card-tiers']) {
      expect((await app.request(`/api/players/${ME}/${sub}`)).status).toBe(404)
    }
    expect(fake.calls.length).toBe(0)
  })
})

describe('GET /api/players/:id/vs/:opp', () => {
  it('returns the head-to-head top cards', async () => {
    const { app } = makeApp({ [`/players/${ME}/vs/${SID}/top-cards`]: { player_cards: [{ card_name: 'Poison', picks: 3, wins: 1 }], opponent_cards: [] } })
    const body = await (await app.request(`/api/players/${ME}/vs/${SID}`)).json()
    expect(body.data.player_cards[0].card_name).toBe('Poison')
    expect((await app.request(`/api/players/${ME}/vs/nope`)).status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/players.test.ts` — expected FAIL.

- [ ] **Step 3: Write `src/server/routes/players.ts`**

```ts
import type { Context, Hono } from 'hono'
import { maskProfile, slimMatch } from '../../shared/privacy'
import { TTL, type TtlSpec } from '../cache'
import type { Query } from '../upstream'
import { errorResponse, intParam, isSteamId, loaderFor, ok, type RouteDeps } from './common'

interface SubSpec {
  path: (id: string) => string
  query?: (c: Context) => Query
  spec: TtlSpec
  transform?: (v: unknown) => unknown
}

const SUB: Record<string, SubSpec> = {
  matches: {
    path: (id) => `/players/${id}/matches`,
    query: (c) => ({ limit: intParam(c, 'limit', 100, 1, 200), offset: intParam(c, 'offset', 0, 0, 100_000) }),
    spec: TTL.PLAYER,
    transform: (v) => (Array.isArray(v) ? v.map((m) => slimMatch(m as Record<string, unknown>)) : []),
  },
  'matches-summary': { path: (id) => `/players/${id}/matches/summary`, spec: TTL.PLAYER },
  'rating-history': { path: (id) => `/players/${id}/rating-history`, spec: TTL.PLAYER },
  'team-history': { path: (id) => `/players/${id}/team-history`, spec: TTL.PLAYER },
  'ffa-history': { path: (id) => `/players/${id}/ffa-history`, spec: TTL.PLAYER },
  'ovt-history': { path: (id) => `/players/${id}/ovt-history`, spec: TTL.PLAYER },
  'team-stats': { path: (id) => `/team/players/${id}/team-stats`, spec: TTL.PLAYER },
  achievements: { path: (id) => `/achievements/${id}`, spec: TTL.PLAYER },
  tournaments: { path: (id) => `/tournaments/players/${id}/tournaments`, spec: TTL.PLAYER },
}

export function registerPlayerRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/players/:id', async (c) => {
    const id = c.req.param('id')
    if (!isSteamId(id)) return c.json({ error: 'bad_steam_id' }, 400)
    const me = c.req.query('me')
    const viewer = isSteamId(me) && me !== id ? me : undefined
    try {
      const r = await loaderFor(d, c)<Record<string, unknown>>(
        `player:${id}:${viewer ?? ''}`,
        TTL.PLAYER,
        `/players/${id}`,
        { viewer_steam_id: viewer },
      )
      return ok(c, { ...r, value: maskProfile(r.value) })
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/:id/vs/:opp', async (c) => {
    const id = c.req.param('id')
    const opp = c.req.param('opp')
    if (!isSteamId(id) || !isSteamId(opp)) return c.json({ error: 'bad_steam_id' }, 400)
    try {
      return ok(c, await loaderFor(d, c)(`vs:${id}:${opp}`, TTL.PLAYER, `/players/${id}/vs/${opp}/top-cards`))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/:id/:sub', async (c) => {
    const id = c.req.param('id')
    const sub = c.req.param('sub')
    if (!isSteamId(id)) return c.json({ error: 'bad_steam_id' }, 400)
    const spec = SUB[sub]
    if (!spec) return c.json({ error: 'not_found' }, 404)
    const query = spec.query?.(c)
    const key = `player:${id}:${sub}:${JSON.stringify(query ?? {})}`
    try {
      const r = await loaderFor(d, c)<unknown>(key, spec.spec, spec.path(id), query)
      return ok(c, spec.transform ? { ...r, value: spec.transform(r.value) } : r)
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
```

- [ ] **Step 4: Register in `src/server/app.ts`**

Add `import { registerPlayerRoutes } from './routes/players'` and the line `registerPlayerRoutes(app, routeDeps)` after `registerBoardRoutes(app, routeDeps)` (order matters: search before `:id`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/server/players.test.ts tests/server/boards.test.ts` — expected PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/players.ts src/server/app.ts tests/server/players.test.ts
git commit -m "Add player profile, history and head-to-head routes with masking"
```

---

### Task 13: Tournaments, cards and chat routes

**Files:**
- Create: `src/server/routes/tournaments.ts`, `src/server/routes/cards.ts`, `src/server/routes/chat.ts`
- Modify: `src/server/app.ts` (register)
- Test: `tests/server/tournaments.test.ts`, `tests/server/cards.test.ts`, `tests/server/chat.test.ts`

**Interfaces:**
- Produces: `GET /api/tournaments` → `{ data: { sync: TournamentCurrent | null, async: TournamentCurrent | null }, errors }`; `GET /api/tournaments/history` → `{ data: { rows: TournamentHistoryRow[], detail: TournamentHistoryDetail['tournaments'] }, errors }`; `GET /api/tournaments/:id/bracket` → `BracketDetail`.
- Produces: `GET /api/cards?filter=all|ranked|casual&sort=&order=` → `CardStat[]`; `GET /api/cards/leaders` → `{ sweepers: CardLeader[], winners: CardLeader[] }` with `CardLeader = { card: string; player: string; count: number }`; `GET /api/cards/:name/pickers` → `CardTopPickers`.
- Produces: `GET /api/chat/recent?limit=&channels=` (only with feature `chat`) → `{ messages: ChatMessage[] }` masked.

- [ ] **Step 1: Write the failing tests**

`tests/server/tournaments.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const CUR = (kind: string) => ({ tournament_id: `id-${kind}`, status: 'voting', kind, signups: [], matches: [], time_slot_options: [], time_slot_tallies: [], force_vote_count: 0, min_players: 8, max_players: 16 })

describe('tournaments', () => {
  it('returns both kinds from /tournaments/current', async () => {
    let n = 0
    const { app, fake } = makeApp({ '/tournaments/current': () => json(CUR(n++ === 0 ? 'sync' : 'async')) })
    const body = await (await app.request('/api/tournaments')).json()
    expect(body.data.sync.kind).toBe('sync')
    expect(body.data.async.kind).toBe('async')
    expect(fake.calls.map((c) => c.url.searchParams.get('kind')).sort()).toEqual(['async', 'sync'])
    expect(body.errors).toEqual([])
  })

  it('returns history rows and detail', async () => {
    const { app, fake } = makeApp({
      '/tournaments/history': [{ tournament_id: 'a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c', kind: 'async', winner_display_name: 'Sid' }],
      '/tournaments/history-detail': { tournaments: [{ tournament_id: 'a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c', participants: [] }] },
    })
    const body = await (await app.request('/api/tournaments/history')).json()
    expect(body.data.rows[0].winner_display_name).toBe('Sid')
    expect(body.data.detail[0].participants).toEqual([])
    expect(fake.calls.find((c) => c.url.pathname.endsWith('history-detail'))!.url.searchParams.get('limit')).toBe('8')
  })

  it('validates the bracket id as a UUID', async () => {
    const { app } = makeApp({ '/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket-detail': { matches: [{ match_id: 'm', games: [] }] } })
    const body = await (await app.request('/api/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket')).json()
    expect(body.data.matches[0].match_id).toBe('m')
    expect((await app.request('/api/tournaments/not-a-uuid/bracket')).status).toBe(400)
  })
})
```

`tests/server/cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'

const CARD = { card_name: 'Poison', card_rarity: 'Common', times_picked: 8619, win_rate: 0.4321, pass_rate: 0.3405 }

describe('cards', () => {
  it('maps filter to is_ranked and validates sort', async () => {
    const { app, fake } = makeApp({ '/cards': [CARD] })
    expect((await (await app.request('/api/cards')).json()).data[0].card_name).toBe('Poison')
    await app.request('/api/cards?filter=ranked&sort=win_rate&order=asc')
    await app.request('/api/cards?filter=casual')
    const q = fake.calls.map((c) => Object.fromEntries(c.url.searchParams))
    expect(q[0]).toEqual({ limit: '200', min_picks: '5', sort_by: 'times_picked', order: 'desc' })
    expect(q[1]).toEqual({ limit: '200', min_picks: '5', sort_by: 'win_rate', order: 'asc', is_ranked: 'true' })
    expect(q[2].is_ranked).toBe('false')
    expect((await app.request('/api/cards?filter=weird')).status).toBe(400)
    expect((await app.request('/api/cards?sort=drop_table')).status).toBe(400)
  })

  it('parses the pipe-joined leader strings', async () => {
    const { app } = makeApp({ '/cards/leaders-summary': { sweepers: ['Big Bullet|Stan|28'], winners: ['Careful Planning|Sid|42', 'broken'] } })
    const body = await (await app.request('/api/cards/leaders')).json()
    expect(body.data.sweepers).toEqual([{ card: 'Big Bullet', player: 'Stan', count: 28 }])
    expect(body.data.winners).toEqual([{ card: 'Careful Planning', player: 'Sid', count: 42 }])
  })

  it('looks up top pickers by card name', async () => {
    const { app, fake } = makeApp({ '/cards/top-pickers': { card_name: 'Poison', display_names: ['Sid'], steam_ids: ['76561198040410653'], picks: [537], win_rates: [0.95] } })
    const body = await (await app.request('/api/cards/Poison/pickers')).json()
    expect(body.data.display_names).toEqual(['Sid'])
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ card_name: 'Poison', limit: '10' })
    expect((await app.request('/api/cards/' + 'x'.repeat(65) + '/pickers')).status).toBe(400)
  })
})
```

`tests/server/chat.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'

const MSG = { source: 'ingame', id: 1, steam_id: '76561199075924855', discord_id: '42', display_name: 'Dopex', rating: 1440, title: 'Beginner V', title_color: '#4D1376', channel: 'ru', message: 'hi', timestamp: '2026-09-05T10:23:16Z' }

describe('chat', () => {
  it('is hidden unless the chat feature is on', async () => {
    const { app, fake } = makeApp({ '/chat/recent': { messages: [MSG] } })
    expect((await app.request('/api/chat/recent')).status).toBe(404)
    expect(fake.calls.length).toBe(0)
  })

  it('masks discord ids and forwards limit/channels when enabled', async () => {
    const { app, fake } = makeApp({ '/chat/recent': { messages: [MSG] } }, { SCR_FEATURES: 'chat' })
    const body = await (await app.request('/api/chat/recent?limit=10&channels=global,ru;DROP')).json()
    expect(body.data.messages[0]).not.toHaveProperty('discord_id')
    expect(body.data.messages[0].display_name).toBe('Dopex')
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ limit: '10', channels: 'global' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/server/tournaments.test.ts tests/server/cards.test.ts tests/server/chat.test.ts` — expected FAIL.

- [ ] **Step 3: Write `src/server/routes/tournaments.ts`**

```ts
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
```

- [ ] **Step 4: Write `src/server/routes/cards.ts`**

```ts
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
    const name = decodeURIComponent(c.req.param('name')).trim()
    if (name.length < 1 || name.length > 64) return c.json({ error: 'bad_card_name' }, 400)
    try {
      return ok(c, await loaderFor(d, c)(`cards:pickers:${name.toLowerCase()}`, TTL.REF, '/cards/top-pickers', { card_name: name, limit: 10 }))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
```

- [ ] **Step 5: Write `src/server/routes/chat.ts`**

```ts
import type { Hono } from 'hono'
import type { ChatRecent } from '../../shared/api-types'
import { maskChatMessage } from '../../shared/privacy'
import { TTL } from '../cache'
import { errorResponse, intParam, loaderFor, ok, type RouteDeps } from './common'

// Mirrors the server's CHAT_CHANNELS_ALLOWED; unknown tokens are dropped, never forwarded.
const CHAT_CHANNELS = new Set(['global', 'ru', 'es', 'uk', 'sv'])

export function registerChatRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/chat/recent', async (c) => {
    if (!d.env.features.has('chat')) return c.json({ error: 'feature_disabled' }, 404)
    const limit = intParam(c, 'limit', 50, 1, 200)
    const channels = (c.req.query('channels') ?? '')
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter((s) => CHAT_CHANNELS.has(s))
      .join(',')
    try {
      const r = await loaderFor(d, c)<ChatRecent>(`chat:${limit}:${channels}`, TTL.LIVE, '/chat/recent', {
        limit,
        channels: channels || undefined,
      })
      const messages = (r.value.messages ?? []).map((m) => maskChatMessage(m as unknown as Record<string, unknown>))
      return ok(c, { ...r, value: { messages } })
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
```

- [ ] **Step 6: Register in `src/server/app.ts`**

Add the three imports and, after `registerPlayerRoutes(app, routeDeps)`:

```ts
  registerTournamentRoutes(app, routeDeps)
  registerCardRoutes(app, routeDeps)
  registerChatRoutes(app, routeDeps)
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run` — expected: all files pass. `npm run typecheck` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/server/routes src/server/app.ts tests/server
git commit -m "Add tournament, card and chat routes"
```

---

### Task 14: Static SPA serving with BASE_PATH (Node)

**Files:**
- Create: `src/server/static.ts`
- Test: `tests/server/static.test.ts`

**Interfaces:**
- Produces: `registerStatic(app: Hono, opts: { root: string; basePath: string }): void`. Must be called after every API route is registered. Serves files under `root`, `index.html` for any other non-API path (SPA fallback), JSON 404 for unknown `/api/*` and `/auth/*`.

- [ ] **Step 1: Write the failing test**

`tests/server/static.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { makeApp } from './helpers/makeApp'
import { registerStatic } from '../../src/server/static'

let root: string
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scr-static-'))
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>SCR Hub</title><div id="root"></div>')
  await mkdir(path.join(root, 'assets'))
  await writeFile(path.join(root, 'assets', 'app-abc123.js'), 'console.log("hi")')
})

describe('static serving', () => {
  it('serves index.html at / and for client routes, and real files by path', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const home = await app.request('/')
    expect(home.status).toBe(200)
    expect(home.headers.get('content-type')).toContain('text/html')
    expect(await home.text()).toContain('SCR Hub')
    expect(await (await app.request('/leaderboards/1v1')).text()).toContain('SCR Hub')
    const js = await app.request('/assets/app-abc123.js')
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toContain('javascript')
    expect(js.headers.get('cache-control')).toContain('immutable')
  })

  it('keeps unknown API and auth paths as JSON 404s', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('not_found')
    expect((await app.request('/auth/nope')).status).toBe(404)
  })

  it('refuses path traversal', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const res = await app.request('/assets/../../etc/passwd')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('SCR Hub') // falls back to the SPA, never reads outside root
  })

  it('works under a BASE_PATH', async () => {
    const { app } = makeApp({}, { BASE_PATH: '/hub' })
    registerStatic(app, { root, basePath: '/hub' })
    expect(await (await app.request('/hub/')).text()).toContain('SCR Hub')
    expect((await app.request('/hub/assets/app-abc123.js')).status).toBe(200)
    expect((await app.request('/hub/api/nope')).status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/static.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Write `src/server/static.ts`**

```ts
import type { Hono } from 'hono'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const PLACEHOLDER =
  '<!doctype html><meta charset="utf-8"><title>SCR Hub</title>' +
  '<p>SCR Hub server is running. The frontend is not built yet: run <code>npm run build:web</code>.</p>'

/** Serves the built SPA from `root` (Node only). Register after all API routes. */
export function registerStatic(app: Hono, opts: { root: string; basePath: string }) {
  const root = path.resolve(opts.root)
  const prefix = opts.basePath === '/' ? '' : opts.basePath

  app.get('/*', async (c) => {
    let p = c.req.path
    if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length) || '/'
    if (p.startsWith('/api/') || p.startsWith('/auth/')) return c.json({ error: 'not_found' }, 404)

    let rel = ''
    try {
      rel = decodeURIComponent(p).replace(/^\/+/, '')
    } catch {
      rel = ''
    }
    if (rel) {
      const target = path.resolve(root, rel)
      if (target.startsWith(root + path.sep)) {
        try {
          const s = await stat(target)
          if (s.isFile()) {
            const body = await readFile(target)
            const ext = path.extname(target).toLowerCase()
            c.header('Content-Type', TYPES[ext] ?? 'application/octet-stream')
            c.header('Cache-Control', rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
            return c.body(body)
          }
        } catch {
          // not a file: fall through to the SPA shell
        }
      }
    }
    try {
      const html = await readFile(path.join(root, 'index.html'), 'utf8')
      c.header('Cache-Control', 'no-cache')
      return c.html(html)
    } catch {
      return c.html(PLACEHOLDER)
    }
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/static.test.ts` — expected PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/static.ts tests/server/static.test.ts
git commit -m "Add static SPA serving with base path support"
```

---

### Task 15: Discord sign-in and `/api/me`

**Files:**
- Create: `src/server/session.ts`, `src/server/routes/auth.ts`
- Modify: `src/server/app.ts` (register; pass `discordFetch`)
- Test: `tests/server/session.test.ts`, `tests/server/auth.test.ts`

**Interfaces:**
- Produces (session.ts): `signSession(payload: SessionPayload, secret: string): Promise<string>`, `verifySession(token: string | undefined, secret: string, nowMs?: number): Promise<SessionPayload | null>`, `interface SessionPayload { id: string; username: string; avatar: string | null; global_name: string | null; exp: number }` (exp in epoch seconds), `randomState(): string`.
- Produces (auth.ts): `registerAuthRoutes(app, d: RouteDeps & { discordFetch?: typeof fetch })`; routes `GET /auth/discord/login`, `GET /auth/discord/callback`, `POST /auth/logout`, `GET /api/me` (spec 8). Cookie names `scrhub_session` (30 days) and `scrhub_oauth_state` (10 minutes).

- [ ] **Step 1: Write the failing session test**

`tests/server/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { signSession, verifySession, randomState } from '../../src/server/session'

const payload = { id: '1299197810780143656', username: 'ntnic', avatar: null, global_name: 'Nic', exp: Math.floor(Date.now() / 1000) + 3600 }

describe('session tokens', () => {
  it('round-trips a signed payload', async () => {
    const token = await signSession(payload, 'secret-1')
    expect(token.split('.').length).toBe(2)
    expect(await verifySession(token, 'secret-1')).toEqual(payload)
  })

  it('rejects a bad signature, a different secret, tampering and expiry', async () => {
    const token = await signSession(payload, 'secret-1')
    expect(await verifySession(token, 'secret-2')).toBeNull()
    expect(await verifySession(token + 'x', 'secret-1')).toBeNull()
    const [body, sig] = token.split('.')
    expect(await verifySession(`${body.slice(0, -2)}AA.${sig}`, 'secret-1')).toBeNull()
    const expired = await signSession({ ...payload, exp: Math.floor(Date.now() / 1000) - 1 }, 'secret-1')
    expect(await verifySession(expired, 'secret-1')).toBeNull()
    expect(await verifySession(undefined, 'secret-1')).toBeNull()
    expect(await verifySession('garbage', 'secret-1')).toBeNull()
  })

  it('makes unpredictable url-safe states', () => {
    const a = randomState()
    const b = randomState()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,}$/)
  })
})
```

- [ ] **Step 2: Write the failing auth test**

`tests/server/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/server/app'
import { parseEnv } from '../../src/server/env'
import { MemoryCacheStore } from '../../src/server/cache'
import { fakeUpstream, json } from './helpers/fakeUpstream'

const DISCORD_ID = '1299197810780143656'
const AUTH_ENV = { DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'csecret', SESSION_SECRET: 'ssecret', SCR_MOD_VERSION_OVERRIDE: '1.40.3', SCR_UPSTREAM_BASE: 'https://up.test', PUBLIC_BASE_URL: 'https://hub.test' }

function discordFake() {
  const calls: Array<{ url: string; body?: string; auth?: string }> = []
  const discordFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push({ url, body: init?.body ? String(init.body) : undefined, auth: new Headers(init?.headers).get('authorization') ?? undefined })
    if (url === 'https://discord.com/api/oauth2/token') return json({ access_token: 'tok', token_type: 'Bearer' })
    if (url === 'https://discord.com/api/users/@me') return json({ id: DISCORD_ID, username: 'ntnic', avatar: null, global_name: 'Nic' })
    return json({ message: 'nope' }, 404)
  }) as typeof fetch
  return { discordFetch, calls }
}

function cookieOf(res: Response, name: string): string | undefined {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(name + '='))
  return raw?.split(';')[0].slice(name.length + 1)
}

function make(envExtra: Record<string, string> = {}) {
  const fake = fakeUpstream({ [`/players/by-discord/${DISCORD_ID}`]: { steam_id: '76561199311926326', display_name: 'NotNic', discord_id: DISCORD_ID, rating: 1101.8, peak_rating: 1337.7, level: 40 } })
  const discord = discordFake()
  const { app } = createApp({ env: parseEnv({ ...AUTH_ENV, ...envExtra }), fetchImpl: fake.fetchImpl, store: new MemoryCacheStore(), discordFetch: discord.discordFetch })
  return { app, fake, discord }
}

describe('Discord sign-in', () => {
  it('redirects to Discord with client id, redirect uri, identify scope and a state cookie', async () => {
    const { app } = make()
    const res = await app.request('/auth/discord/login')
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location')!)
    expect(loc.origin + loc.pathname).toBe('https://discord.com/oauth2/authorize')
    expect(loc.searchParams.get('client_id')).toBe('cid')
    expect(loc.searchParams.get('scope')).toBe('identify')
    expect(loc.searchParams.get('redirect_uri')).toBe('https://hub.test/auth/discord/callback')
    const state = cookieOf(res, 'scrhub_oauth_state')
    expect(state).toBeTruthy()
    expect(loc.searchParams.get('state')).toBe(state)
  })

  it('completes the code exchange, sets the session cookie and resolves the linked player', async () => {
    const { app, discord } = make()
    const login = await app.request('/auth/discord/login')
    const state = cookieOf(login, 'scrhub_oauth_state')!
    const cb = await app.request(`/auth/discord/callback?code=abc&state=${state}`, { headers: { cookie: `scrhub_oauth_state=${state}` } })
    expect(cb.status).toBe(302)
    expect(cb.headers.get('location')).toBe('/?auth=ok')
    const session = cookieOf(cb, 'scrhub_session')
    expect(session).toBeTruthy()
    expect(discord.calls[0].body).toContain('client_secret=csecret')
    expect(discord.calls[0].body).toContain('code=abc')
    expect(discord.calls[1].auth).toBe('Bearer tok')

    const me = await (await app.request('/api/me', { headers: { cookie: `scrhub_session=${session}` } })).json()
    expect(me.auth_enabled).toBe(true)
    expect(me.data.discord).toEqual({ id: DISCORD_ID, username: 'ntnic', avatar: null, global_name: 'Nic' })
    expect(me.data.player).toEqual({ steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101.8, peak_rating: 1337.7, level: 40 })
    expect(JSON.stringify(me)).not.toContain('discord_id')
  })

  it('rejects a state mismatch without setting a session', async () => {
    const { app, discord } = make()
    const cb = await app.request('/auth/discord/callback?code=abc&state=wrong', { headers: { cookie: 'scrhub_oauth_state=right' } })
    expect(cb.headers.get('location')).toBe('/?auth=failed')
    expect(cookieOf(cb, 'scrhub_session')).toBeUndefined()
    expect(discord.calls.length).toBe(0)
  })

  it('reports an unlinked player as null and an invalid cookie as signed out', async () => {
    const { app, fake } = make()
    fake.map[`/players/by-discord/${DISCORD_ID}`] = () => json({ detail: 'No player linked' }, 404)
    const login = await app.request('/auth/discord/login')
    const state = cookieOf(login, 'scrhub_oauth_state')!
    const cb = await app.request(`/auth/discord/callback?code=abc&state=${state}`, { headers: { cookie: `scrhub_oauth_state=${state}` } })
    const session = cookieOf(cb, 'scrhub_session')
    const me = await (await app.request('/api/me', { headers: { cookie: `scrhub_session=${session}` } })).json()
    expect(me.data.discord?.username).toBe('ntnic')
    expect(me.data.player).toBeNull()
    const bad = await (await app.request('/api/me', { headers: { cookie: 'scrhub_session=garbage' } })).json()
    expect(bad.data).toEqual({ discord: null, player: null })
  })

  it('logout clears the cookie', async () => {
    const { app } = make()
    const res = await app.request('/auth/logout', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(res.headers.getSetCookie().find((c) => c.startsWith('scrhub_session='))).toContain('Max-Age=0')
  })

  it('is disabled without the three variables', async () => {
    const fake = fakeUpstream({})
    const { app } = createApp({ env: parseEnv({ SCR_MOD_VERSION_OVERRIDE: '1.40.3' }), fetchImpl: fake.fetchImpl })
    expect((await app.request('/auth/discord/login')).status).toBe(404)
    const me = await (await app.request('/api/me')).json()
    expect(me).toEqual({ data: { discord: null, player: null }, auth_enabled: false })
  })

  it('honours BASE_PATH in the redirect uri and post-login redirect', async () => {
    const { app } = make({ BASE_PATH: '/hub' })
    const res = await app.request('/hub/auth/discord/login')
    expect(new URL(res.headers.get('location')!).searchParams.get('redirect_uri')).toBe('https://hub.test/hub/auth/discord/callback')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/server/session.test.ts tests/server/auth.test.ts` — expected FAIL.

- [ ] **Step 4: Write `src/server/session.ts`**

```ts
// Signed, stateless session cookie for Discord identity (spec 8). Web Crypto only,
// so it runs identically on Node and Cloudflare Workers.

export interface SessionPayload {
  id: string
  username: string
  avatar: string | null
  global_name: string | null
  exp: number // epoch seconds
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = b64url(await hmac(secret, body))
  return `${body}.${sig}`
}

export async function verifySession(token: string | undefined, secret: string, nowMs = Date.now()): Promise<SessionPayload | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [body, sig] = parts
  const expected = b64url(await hmac(secret, body))
  if (!constantTimeEqual(expected, sig)) return null
  try {
    const p = JSON.parse(dec.decode(fromB64url(body))) as SessionPayload
    if (typeof p.id !== 'string' || typeof p.exp !== 'number') return null
    if (p.exp * 1000 < nowMs) return null
    return p
  } catch {
    return null
  }
}

export function randomState(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(24)))
}
```

- [ ] **Step 5: Write `src/server/routes/auth.ts`**

```ts
import type { Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { PlayerByDiscord } from '../../shared/api-types'
import type { MeResponse } from '../../shared/hub-types'
import { TTL } from '../cache'
import { randomState, signSession, verifySession } from '../session'
import { UpstreamError } from '../upstream'
import { backgroundFor, errorResponse, type RouteDeps } from './common'

export const SESSION_COOKIE = 'scrhub_session'
const STATE_COOKIE = 'scrhub_oauth_state'
const SESSION_DAYS = 30
const DISCORD_ID_RE = /^\d{1,32}$/

function isHttps(c: Context): boolean {
  return c.req.url.startsWith('https://') || c.req.header('x-forwarded-proto') === 'https'
}

export function registerAuthRoutes(app: Hono, d: RouteDeps & { discordFetch?: typeof fetch }) {
  const cfg = d.env.discord
  const prefix = d.env.basePath === '/' ? '' : d.env.basePath
  const home = prefix ? `${prefix}/` : '/'

  if (!cfg) {
    app.get('/auth/*', (c) => c.json({ error: 'auth_disabled' }, 404))
    app.post('/auth/*', (c) => c.json({ error: 'auth_disabled' }, 404))
    app.get('/api/me', (c) => c.json({ data: { discord: null, player: null }, auth_enabled: false } satisfies MeResponse))
    return
  }

  const f = d.discordFetch ?? fetch
  const redirectUri = (c: Context) => `${d.env.publicBaseUrl ?? new URL(c.req.url).origin}${prefix}/auth/discord/callback`

  app.get('/auth/discord/login', (c) => {
    const state = randomState()
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, sameSite: 'Lax', secure: isHttps(c), path: '/', maxAge: 600 })
    const u = new URL('https://discord.com/oauth2/authorize')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri(c))
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', 'identify')
    u.searchParams.set('state', state)
    return c.redirect(u.toString())
  })

  app.get('/auth/discord/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const expected = getCookie(c, STATE_COOKIE)
    deleteCookie(c, STATE_COOKIE, { path: '/' })
    if (!code || !state || !expected || state !== expected) return c.redirect(`${home}?auth=failed`)
    try {
      const tokenRes = await f('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(c),
        }).toString(),
      })
      if (!tokenRes.ok) return c.redirect(`${home}?auth=failed`)
      const { access_token } = (await tokenRes.json()) as { access_token?: string }
      if (!access_token) return c.redirect(`${home}?auth=failed`)
      const meRes = await f('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } })
      if (!meRes.ok) return c.redirect(`${home}?auth=failed`)
      const u = (await meRes.json()) as { id: string; username: string; avatar?: string | null; global_name?: string | null }
      if (!DISCORD_ID_RE.test(u.id)) return c.redirect(`${home}?auth=failed`)
      const token = await signSession(
        {
          id: u.id,
          username: u.username,
          avatar: u.avatar ?? null,
          global_name: u.global_name ?? null,
          exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
        },
        cfg.sessionSecret,
      )
      setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure: isHttps(c), path: '/', maxAge: SESSION_DAYS * 86400 })
      return c.redirect(`${home}?auth=ok`)
    } catch (err) {
      console.error('[auth] discord exchange failed', err)
      return c.redirect(`${home}?auth=failed`)
    }
  })

  app.post('/auth/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/me', async (c) => {
    c.header('Cache-Control', 'no-store')
    const s = await verifySession(getCookie(c, SESSION_COOKIE), cfg.sessionSecret)
    if (!s || !DISCORD_ID_RE.test(s.id)) {
      return c.json({ data: { discord: null, player: null }, auth_enabled: true } satisfies MeResponse)
    }
    let player: MeResponse['data']['player'] = null
    try {
      const r = await d.cache.get<PlayerByDiscord>(
        `by-discord:${s.id}`,
        TTL.PLAYER,
        () => d.upstream.getJson<PlayerByDiscord>(`/players/by-discord/${s.id}`),
        backgroundFor(c),
      )
      const p = r.value
      player = { steam_id: p.steam_id, display_name: p.display_name, rating: p.rating, peak_rating: p.peak_rating, level: p.level }
    } catch (err) {
      if (!(err instanceof UpstreamError && err.status === 404)) return errorResponse(c, err)
    }
    const body: MeResponse = {
      data: { discord: { id: s.id, username: s.username, avatar: s.avatar, global_name: s.global_name }, player },
      auth_enabled: true,
    }
    return c.json(body)
  })
}
```

- [ ] **Step 6: Register in `src/server/app.ts`**

Add `import { registerAuthRoutes } from './routes/auth'` and, after `registerChatRoutes(app, routeDeps)`, the line `registerAuthRoutes(app, { ...routeDeps, discordFetch: deps.discordFetch ?? deps.fetchImpl })`.

Note on `deps.fetchImpl` as the Discord fallback: in fixture mode, Discord calls also hit the fixture fetch and fail (no fixture), which is the desired "sign-in unavailable in demo" behaviour. In production both are undefined, so global `fetch` is used.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run` — expected: all pass, including 7 auth tests and 3 session tests. `npm run typecheck` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/server/session.ts src/server/routes/auth.ts src/server/app.ts tests/server/session.test.ts tests/server/auth.test.ts
git commit -m "Add Discord sign-in with signed session cookie and /api/me"
```

---

### Task 16: Node entry, server build, fixture-mode smoke test and README

**Files:**
- Create: `src/server/node.ts`
- Modify: `package.json` (scripts already exist from Task 1), `README.md`
- Test: manual smoke test with curl (documented below); the unit suite already covers the app

**Interfaces:**
- Produces: `npm run dev:server` (tsx watch), `npm run build:server`, `npm start`. Environment: `PORT` (default 8080), `SCR_WEB_ROOT` (default `dist/web`), plus every variable from spec 6.5.

- [ ] **Step 1: Write `src/server/node.ts`**

```ts
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { MemoryCacheStore } from './cache'
import { modeOf, parseEnv } from './env'
import { createFixtureFetch } from './fixtures'
import { registerStatic } from './static'

const env = parseEnv(process.env)
const fetchImpl = env.fixtures ? createFixtureFetch(env.fixturesDir) : undefined
const { app } = createApp({ env, fetchImpl, store: new MemoryCacheStore() })
registerStatic(app, { root: process.env.SCR_WEB_ROOT || 'dist/web', basePath: env.basePath })

const port = Number(process.env.PORT || 8080)
serve({ fetch: app.fetch, port }, (info) => {
  const base = env.basePath === '/' ? '' : env.basePath
  console.log(`[scr-hub] ${modeOf(env)} mode listening on http://localhost:${info.port}${base}/  (upstream ${env.upstreamBase})`)
})
```

- [ ] **Step 2: Build and run in fixture mode**

```bash
npm run build:server
SCR_FIXTURES=1 PORT=8080 node dist/server/node.js &
sleep 1
curl -s http://localhost:8080/api/_status
curl -s http://localhost:8080/api/home | head -c 600
curl -s "http://localhost:8080/api/leaderboard/1v1" | head -c 300
curl -s http://localhost:8080/api/players/76561199311926326 | grep -o '"discord_id"' || echo "no discord_id leaked"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
kill %1
```

Expected: `_status` shows `"mode":"fixtures"`; `/api/home` returns `"errors":[]` with presence data from the fixtures; the leaderboard has entries; the grep prints `no discord_id leaked`; `/` returns `200` (placeholder page until the web plan builds the SPA).

- [ ] **Step 3: Run once against the live server (community mode)**

```bash
PORT=8081 node dist/server/node.js &
sleep 2
curl -s "http://localhost:8081/api/_status?probe=1"
curl -s http://localhost:8081/api/home | head -c 400
kill %1
```

Expected: `"reachable":true`, `upstream.version.source` is `discovered` with the current version, and live presence data.

- [ ] **Step 4: Write `README.md`**

```markdown
# SCR Hub

A browser companion for Sid's Competitive Rounds: who is online, live games, leaderboards, player stats, results, tournaments and card stats, from any device, without launching the game.

One codebase, two deployment modes (see `docs/superpowers/specs/2026-09-22-scr-hub-design.md`):

- **Community mode** – runs on any host, needs nothing from Sid, read-only.
- **Hosted mode** – the same build next to Sid's API with a server-side internal key.

## Run locally

```bash
npm install
npm run capture            # optional: refresh fixtures/ from the live API
SCR_FIXTURES=1 npm run dev:server   # server on http://localhost:8080 answering from fixtures/
```

Without `SCR_FIXTURES` the server talks to the live API (`SCR_UPSTREAM_BASE`, default `https://competitive-rounds.duckdns.org:8444`).

## Test

```bash
npm test          # unit + integration (no network)
npm run typecheck
npm run contract  # hits the live API once per endpoint and checks the shapes (manual)
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SCR_UPSTREAM_BASE` | `https://competitive-rounds.duckdns.org:8444` | Sid's API origin |
| `SCR_INTERNAL_KEY` | unset | Hosted mode: sent as `X-Internal-Key`; never reaches the browser |
| `SCR_MOD_VERSION_OVERRIDE` | unset | Pin the `X-Mod-Version` header (otherwise discovered) |
| `SCR_FEATURES` | empty | Comma list, e.g. `chat` |
| `BASE_PATH` | `/` | Mount under a sub-path, e.g. `/hub` |
| `PUBLIC_BASE_URL` | derived | Absolute site URL for OAuth redirects |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` | unset | All three enable Discord sign-in |
| `SCR_FIXTURES` | unset | `1` answers from `fixtures/` (demo, tests) |
| `PORT` | `8080` | Node listen port |

## API (served to the frontend)

`/api/home`, `/api/leaderboard/:mode`, `/api/results`, `/api/results/1v1`, `/api/players/search?q=`, `/api/players/:id`, `/api/players/:id/{matches,matches-summary,rating-history,team-history,ffa-history,ovt-history,team-stats,achievements,tournaments}`, `/api/players/:id/vs/:opp`, `/api/tournaments`, `/api/tournaments/history`, `/api/tournaments/:id/bracket`, `/api/cards`, `/api/cards/leaders`, `/api/cards/:name/pickers`, `/api/chat/recent` (feature `chat`), `/api/meta`, `/api/me`, `/api/_status`. Every response is `{ data, fetched_at, stale }`.

## Deploy

- Cloudflare Workers (community): see `wrangler.toml`; `npx wrangler login` once, then `npm run build && npm run deploy:cf`.
- Docker (hosted): `docker build -t scr-hub .` and the compose snippet in `docs/for-sid.md`.
```

- [ ] **Step 5: Commit**

```bash
git add src/server/node.ts README.md
git commit -m "Add Node entry with fixture mode and document running the server"
```

---

### Task 17: Cloudflare Worker entry, Cache API store and the port-8444 check

**Files:**
- Create: `src/server/cf-cache.ts`, `src/server/worker.ts`, `wrangler.toml`
- Modify: `package.json` (add `deploy:cf`, install wrangler)
- Test: `tests/server/cf-cache.test.ts`

**Interfaces:**
- Produces: `class CfCacheStore implements CacheStore` (memory first, Cache API second; constructor `(memory: MemoryCacheStore, cachesApi?: CachesLike)`), the Worker default export, and `npm run deploy:cf`.

- [ ] **Step 1: Install wrangler and add the script**

```bash
npm install -D wrangler
npm pkg set scripts.deploy:cf="wrangler deploy"
```

- [ ] **Step 2: Write the failing test**

`tests/server/cf-cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CfCacheStore } from '../../src/server/cf-cache'
import { MemoryCacheStore } from '../../src/server/cache'

function fakeCaches() {
  const store = new Map<string, Response>()
  return {
    calls: { match: 0, put: 0 },
    default: {
      async match(req: Request) {
        this_calls.match++
        const r = store.get(req.url)
        return r ? r.clone() : undefined
      },
      async put(req: Request, res: Response) {
        this_calls.put++
        store.set(req.url, res)
      },
    },
  }
}
const this_calls = { match: 0, put: 0 }

describe('CfCacheStore', () => {
  it('writes to memory and the Cache API, reads memory first, then falls back to the Cache API', async () => {
    const caches = fakeCaches()
    const memory = new MemoryCacheStore()
    const store = new CfCacheStore(memory, caches)
    await store.set('k', { value: { n: 1 }, fetched_at: 123 })
    expect(this_calls.put).toBe(1)
    expect((await store.get('k'))?.fetched_at).toBe(123)
    expect(this_calls.match).toBe(0)

    const cold = new CfCacheStore(new MemoryCacheStore(), caches)
    const e = await cold.get<{ n: number }>('k')
    expect(e).toEqual({ value: { n: 1 }, fetched_at: 123 })
    expect(this_calls.match).toBe(1)
    expect(await cold.get('missing')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/server/cf-cache.test.ts` — expected FAIL (module not found).

- [ ] **Step 4: Write `src/server/cf-cache.ts`**

```ts
import type { CacheEntry, CacheStore, MemoryCacheStore } from './cache'

export interface CachesLike {
  default: {
    match(req: Request): Promise<Response | undefined>
    put(req: Request, res: Response): Promise<void>
  }
}

/**
 * Workers store: in-isolate memory in front of the per-colo Cache API, so a cold
 * isolate still finds recent data (spec 6.3).
 */
export class CfCacheStore implements CacheStore {
  constructor(
    private readonly memory: MemoryCacheStore,
    private readonly cachesApi: CachesLike = (globalThis as unknown as { caches: CachesLike }).caches,
  ) {}

  private req(key: string): Request {
    return new Request(`https://scr-hub.cache/${encodeURIComponent(key)}`)
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const m = await this.memory.get<T>(key)
    if (m) return m
    if (!this.cachesApi) return undefined
    const res = await this.cachesApi.default.match(this.req(key))
    if (!res) return undefined
    const fetched_at = Number(res.headers.get('x-fetched-at') || 0)
    const value = (await res.json()) as T
    const entry: CacheEntry<T> = { value, fetched_at }
    await this.memory.set(key, entry)
    return entry
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    await this.memory.set(key, entry)
    if (!this.cachesApi) return
    await this.cachesApi.default.put(
      this.req(key),
      new Response(JSON.stringify(entry.value), {
        headers: {
          'content-type': 'application/json',
          'x-fetched-at': String(entry.fetched_at),
          'cache-control': 'public, max-age=3600',
        },
      }),
    )
  }

  size(): number {
    return this.memory.size()
  }
}
```

- [ ] **Step 5: Write `src/server/worker.ts`**

```ts
import { createApp } from './app'
import { MemoryCacheStore } from './cache'
import { CfCacheStore } from './cf-cache'
import { parseEnv } from './env'

type Bindings = Record<string, unknown>

interface ExecutionContextLike {
  waitUntil(p: Promise<unknown>): void
}

let built: { key: string; app: ReturnType<typeof createApp> } | null = null

function getApp(bindings: Bindings) {
  const raw: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(bindings)) if (typeof v === 'string') raw[k] = v
  const key = JSON.stringify(raw)
  if (!built || built.key !== key) {
    built = { key, app: createApp({ env: parseEnv(raw), store: new CfCacheStore(new MemoryCacheStore(300)) }) }
  }
  return built.app
}

export default {
  async fetch(request: Request, bindings: Bindings, ctx: ExecutionContextLike): Promise<Response> {
    const { app } = getApp(bindings)
    return app.fetch(request, bindings, ctx)
  },
}
```

Static assets are served by the platform via the `[assets]` block below; the Worker only runs for `/api/*` and `/auth/*`. `backgroundFor(c)` in `routes/common.ts` picks up `ctx.waitUntil` through Hono's `c.executionCtx`, so background refreshes survive the response.

- [ ] **Step 6: Write `wrangler.toml`**

```toml
name = "scr-hub"
main = "src/server/worker.ts"
compatibility_date = "2026-09-01"

[assets]
directory = "./dist/web"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/auth/*"]

[vars]
SCR_UPSTREAM_BASE = "https://competitive-rounds.duckdns.org:8444"
SCR_APP_VERSION = "0.1.0"
# PUBLIC_BASE_URL = "https://scr-hub.example.workers.dev"   # set after the first deploy
# Secrets (never in this file): npx wrangler secret put DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / SESSION_SECRET
```

- [ ] **Step 7: Run the test, typecheck and a dry-run build**

Run: `npx vitest run tests/server/cf-cache.test.ts` — expected PASS. `npm run typecheck` — clean.

```bash
mkdir -p dist/web && [ -f dist/web/index.html ] || echo '<!doctype html><title>SCR Hub</title><p>placeholder</p>' > dist/web/index.html
npx wrangler deploy --dry-run --outdir dist/cf
```

Expected: wrangler bundles `src/server/worker.ts` without errors (no `node:` imports may end up in the bundle; `fixtures.ts` is only imported by `node.ts`).

- [ ] **Step 8: The port-8444 check (spec risk 1) — needs NotNic's Cloudflare account**

NotNic runs `npx wrangler login` (opens a browser; the agent cannot do this). Then:

```bash
npx wrangler deploy
curl -s "https://scr-hub.<account-subdomain>.workers.dev/api/_status?probe=1"
```

Expected: `"reachable":true` and `"version":{"source":"discovered",...}`. If `reachable` is `false` or the request errors, Workers cannot reach port 8444: record the result in `docs/superpowers/plans/2026-09-22-scr-hub-server.md` under this task, and community mode ships as the Docker image (Task 18) on a small container host instead. Nothing else in the codebase changes.

- [ ] **Step 9: Commit**

```bash
git add src/server/cf-cache.ts src/server/worker.ts wrangler.toml package.json package-lock.json tests/server/cf-cache.test.ts
git commit -m "Add Cloudflare Worker entry, Cache API store and wrangler config"
```

---

### Task 18: Dockerfile for hosted mode

**Files:**
- Create: `Dockerfile`, `.dockerignore`

**Interfaces:**
- Produces: an image that runs `node dist/server/node.js` on port 8080 with the SPA at `dist/web` (built by the web plan's `build:web`; until then the placeholder page is served).

- [ ] **Step 1: Write `.dockerignore`**

```
node_modules
dist
.git
.wrangler
coverage
playwright-report
test-results
docs
```

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# `build` = build:web + build:server once the web plan lands; until then build:server alone.
RUN npm run build 2>/dev/null || npm run build:server
RUN mkdir -p dist/web && [ -f dist/web/index.html ] || echo '<!doctype html><title>SCR Hub</title><p>Frontend not built.</p>' > dist/web/index.html

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 SCR_WEB_ROOT=/app/dist/web
COPY --from=build /app/dist ./dist
COPY --from=build /app/fixtures ./fixtures
EXPOSE 8080
USER node
CMD ["node", "dist/server/node.js"]
```

- [ ] **Step 3: Verify**

Docker is not installed on the development machine. Verification happens on any machine with Docker (Sid's server, or after installing Docker Desktop):

```bash
docker build -t scr-hub .
docker run --rm -p 8080:8080 -e SCR_FIXTURES=1 scr-hub &
sleep 2 && curl -s http://localhost:8080/api/_status && docker stop $(docker ps -q --filter ancestor=scr-hub)
```

Expected: `"mode":"fixtures"`. Until that machine is available, the build steps are the same commands the CI-less repo runs locally (`npm ci`, `npm run build:server`), which Task 16 already exercised.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "Add Dockerfile for hosted mode"
```

---

### Task 19: Live contract check

**Files:**
- Create: `scripts/contract-checks.mjs` (the checks, importable), `scripts/contract-check.mjs` (the runner)
- Test: `tests/server/contract.test.ts` (runs the same checks against `fixtures/`)

**Interfaces:**
- Produces: `CHECKS: Array<{ path: string; fixture: string; check(body): string[] }>` where `check` returns a list of problems (empty = pass); `npm run contract` runs them against the live API and exits 1 on any problem.

- [ ] **Step 1: Write the failing test**

`tests/server/contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { CHECKS } from '../../scripts/contract-checks.mjs'

describe('contract checks against the captured fixtures', () => {
  for (const c of CHECKS) {
    const file = path.resolve('fixtures', `${c.fixture}.json`)
    const run = existsSync(file) ? it : it.skip
    run(`${c.path} matches the expected shape`, () => {
      const body = JSON.parse(readFileSync(file, 'utf8'))
      expect(c.check(body)).toEqual([])
    })
  }

  it('flags a broken leaderboard row', () => {
    const lb = CHECKS.find((c) => c.path.startsWith('/leaderboard'))!
    expect(lb.check({ entries: [{ rank: 1 }], total_players: 1 })).not.toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/contract.test.ts` — expected FAIL (module not found).

- [ ] **Step 3: Write `scripts/contract-checks.mjs`**

```js
// Shape checks for the upstream endpoints the hub depends on (spec 10, "live contract check").
// Each check returns a list of problems; an empty list is a pass.

const ME = process.env.SCR_SAMPLE_STEAM_ID || '76561199311926326'
const OPP = process.env.SCR_SAMPLE_OPPONENT_ID || '76561198040410653'

const has = (o, keys) => keys.filter((k) => !(o && typeof o === 'object' && k in o)).map((k) => `missing ${k}`)
const arr = (o, k) => (Array.isArray(o?.[k]) ? [] : [`${k} is not an array`])
const first = (o, k, keys) => (Array.isArray(o?.[k]) && o[k].length ? has(o[k][0], keys.map((x) => x)).map((p) => `${k}[0] ${p}`) : [])

export const CHECKS = [
  { path: '/mod-version', fixture: 'mod-version', check: (b) => has(b, ['version', 'min_version']) },
  { path: '/admin/maintenance/status', fixture: 'admin__maintenance__status', check: (b) => has(b, ['in_maintenance']) },
  { path: '/alerts/active', fixture: 'alerts__active', check: (b) => [...has(b, ['rev']), ...arr(b, 'alerts')] },
  { path: '/rank-tiers', fixture: 'rank-tiers', check: (b) => [...arr(b, 'tiers'), ...first(b, 'tiers', ['floor', 'name', 'color'])] },
  { path: '/leaderboard?limit=5', fixture: 'leaderboard', check: (b) => [...has(b, ['total_players']), ...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'is_online', 'inactive', 'rating', 'rd', 'wins', 'losses', 'win_rate', 'level', 'gold', 'title', 'title_color', 'rank_name', 'rank_color'])] },
  { path: '/team/leaderboard?limit=5', fixture: 'team__leaderboard', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'rating', 'completed_series', 'series_wins', 'series_losses', 'win_rate'])] },
  { path: '/ffa/leaderboard?limit=5', fixture: 'ffa__leaderboard', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'rating', 'games_played', 'wins', 'top3', 'avg_placement'])] },
  { path: '/ovt/leaderboard?limit=5', fixture: 'ovt__leaderboard', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'games_played', 'wins', 'losses', 'solo_games', 'duo_games'])] },
  { path: '/presence/online', fixture: 'presence__online', check: (b) => [...has(b, ['online_count']), ...arr(b, 'online'), ...arr(b, 'recent')] },
  { path: '/queue/count', fixture: 'queue__count', check: (b) => has(b, ['searching', 'online']) },
  { path: '/team/queue/count', fixture: 'team__queue__count', check: (b) => has(b, ['searching']) },
  { path: '/series/active', fixture: 'series__active', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 'p1_steam_id', 'p1_name', 'p1_rating', 'p1_wins', 'p2_steam_id', 'p2_name', 'p2_rating', 'p2_wins', 'live_p1_points', 'live_p2_points', 'phase'])] },
  { path: '/team/series/active', fixture: 'team__series__active', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 't1a_name', 't1b_name', 't2a_name', 't2b_name', 't1_wins', 't2_wins'])] },
  { path: '/ffa/lobbies', fixture: 'ffa__lobbies', check: (b) => [...arr(b, 'lobbies'), ...first(b, 'lobbies', ['lobby_id', 'host_name', 'player_count', 'max_players', 'members'])] },
  { path: '/spectate/games', fixture: 'spectate__games', check: (b) => [...arr(b, 'games'), ...first(b, 'games', ['game_id', 'mode', 'names', 'spectatable'])] },
  { path: '/series/recent-multimode?limit=5', fixture: 'series__recent-multimode', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['mode', 'id', 'ended_at', 'left_label', 'right_label', 'score'])] },
  { path: '/series/recent?minutes=43200&limit=5', fixture: 'series__recent', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 'p1_name', 'p2_name', 'p1_series_wins', 'p2_series_wins', 'winner_name', 'completed_at'])] },
  { path: '/players/search?q=nic', fixture: 'players__search', check: (b) => [...arr(b, 'results'), ...first(b, 'results', ['steam_id', 'display_name', 'rating'])] },
  { path: `/players/${ME}?viewer_steam_id=${OPP}`, fixture: 'players__ID', check: (b) => has(b, ['steam_id', 'display_name', 'rating', 'peak_rating', 'wins', 'losses', 'level', 'recent_form', 'top_cards', 'recent_rating_history', 'rank_name', 'rank_color', 'h2h_ranked_wins', 'h2h_series_wins', 'show_discord', 'hide_gold']) },
  { path: `/players/${ME}/matches?limit=5`, fixture: 'players__ID__matches', check: (b) => (Array.isArray(b) ? (b.length ? has(b[0], ['match_id', 'opponent_name', 'won', 'is_ranked', 'ended_at', 'cards_picked', 'player_rounds_won', 'opponent_rounds_won']) : []) : ['not an array']) },
  { path: `/players/${ME}/rating-history`, fixture: 'players__ID__rating-history', check: (b) => [...arr(b, 'history'), ...first(b, 'history', ['rating', 'rd', 'date'])] },
  { path: `/players/${ME}/team-history`, fixture: 'players__ID__team-history', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 'won', 'score', 'mate', 'opponents'])] },
  { path: `/players/${ME}/ffa-history`, fixture: 'players__ID__ffa-history', check: (b) => [...arr(b, 'games'), ...first(b, 'games', ['match_id', 'placement', 'player_count', 'rating_change', 'ended_at'])] },
  { path: `/players/${ME}/ovt-history`, fixture: 'players__ID__ovt-history', check: (b) => [...arr(b, 'games'), ...first(b, 'games', ['match_id', 'role', 'won', 'score', 'solo', 'duo'])] },
  { path: `/players/${ME}/vs/${OPP}/top-cards`, fixture: 'players__ID__vs__ID__top-cards', check: (b) => [...arr(b, 'player_cards'), ...arr(b, 'opponent_cards')] },
  { path: `/team/players/${ME}/team-stats`, fixture: 'team__players__ID__team-stats', check: (b) => has(b, ['rating', 'completed_series', 'series_wins', 'series_losses']) },
  { path: '/achievements/definitions', fixture: 'achievements__definitions', check: (b) => (b && typeof b.achievements === 'object' ? [] : ['achievements missing']) },
  { path: `/achievements/${ME}`, fixture: 'achievements__ID', check: (b) => [...arr(b, 'achievements'), ...first(b, 'achievements', ['achievement_key', 'unlocked', 'name', 'global_pct', 'gold'])] },
  { path: '/cards?limit=5', fixture: 'cards', check: (b) => (Array.isArray(b) ? (b.length ? has(b[0], ['card_name', 'card_rarity', 'times_picked', 'win_rate', 'pass_rate']) : []) : ['not an array']) },
  { path: '/cards/leaders-summary', fixture: 'cards__leaders-summary', check: (b) => [...arr(b, 'sweepers'), ...arr(b, 'winners')] },
  { path: '/cards/top-pickers?card_name=Poison', fixture: 'cards__top-pickers', check: (b) => [...has(b, ['card_name']), ...arr(b, 'display_names'), ...arr(b, 'steam_ids'), ...arr(b, 'picks'), ...arr(b, 'win_rates')] },
  { path: '/tournaments/current?kind=sync', fixture: 'tournaments__current', check: (b) => [...has(b, ['status', 'kind', 'min_players', 'max_players']), ...arr(b, 'signups'), ...arr(b, 'matches')] },
  { path: '/tournaments/history', fixture: 'tournaments__history', check: (b) => (Array.isArray(b) ? (b.length ? has(b[0], ['tournament_id', 'kind', 'format', 'winner_display_name', 'signup_count']) : []) : ['not an array']) },
  { path: '/tournaments/history-detail?limit=8', fixture: 'tournaments__history-detail', check: (b) => [...arr(b, 'tournaments'), ...first(b, 'tournaments', ['tournament_id', 'kind', 'participants'])] },
  { path: `/tournaments/players/${ME}/tournaments`, fixture: 'tournaments__players__ID__tournaments', check: (b) => has(b, ['winner_count', 'runner_up_count', 'third_place_count', 'participant_count']) },
  { path: '/chat/recent?limit=3', fixture: 'chat__recent', check: (b) => [...arr(b, 'messages'), ...first(b, 'messages', ['id', 'steam_id', 'display_name', 'channel', 'message', 'timestamp'])] },
  { path: '/releases/recent?limit=3', fixture: 'releases__recent', check: (b) => [...arr(b, 'posts'), ...first(b, 'posts', ['author', 'content', 'posted_at'])] },
]
```

- [ ] **Step 4: Write `scripts/contract-check.mjs`**

```js
// Hits the live API once per dependency and validates the shape. Manual, on demand (spec 10).
import { CHECKS } from './contract-checks.mjs'

const BASE = (process.env.SCR_UPSTREAM_BASE || 'https://competitive-rounds.duckdns.org:8444').replace(/\/+$/, '')
const UA = 'scr-hub-contract/0.1'

async function main() {
  const mv = await (await fetch(`${BASE}/api/v1/mod-version`, { headers: { 'User-Agent': UA } })).json()
  const version = process.env.SCR_MOD_VERSION || mv.version
  let failures = 0
  for (const c of CHECKS) {
    let problems
    try {
      const res = await fetch(`${BASE}/api/v1${c.path}`, {
        headers: { 'User-Agent': UA, 'X-Mod-Version': version, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      problems = res.status === 200 ? c.check(await res.json()) : [`HTTP ${res.status}`]
    } catch (e) {
      problems = [String(e)]
    }
    if (problems.length) failures++
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${c.path}${problems.length ? '  -> ' + problems.join('; ') : ''}`)
    await new Promise((r) => setTimeout(r, 150))
  }
  console.log(`\n${CHECKS.length - failures}/${CHECKS.length} passed (mod version ${version})`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 5: Run the tests, then the live check once**

Run: `npx vitest run tests/server/contract.test.ts` — expected PASS (every fixture-backed check passes; checks whose fixture is missing are skipped).
Run: `npm run contract` — expected: all PASS against the live server. A FAIL here means Sid's API changed shape; fix the type and the consumer, not the check.

- [ ] **Step 6: Commit**

```bash
git add scripts/contract-checks.mjs scripts/contract-check.mjs tests/server/contract.test.ts
git commit -m "Add live contract check with fixture-backed tests"
```

---

## Self-review notes (filled in by the plan author)

- **Spec coverage:** 6.1 routes → Tasks 9–13; 6.2 upstream client → Tasks 4–5; 6.3 cache → Task 6 (+17 for Workers); 6.4 masking → Task 7 (+12, 11, 13 apply it); 6.5 config → Task 1; 7.4 fixture mode → Task 8 and 16; 8 Discord sign-in → Task 15; 9.1 Workers → Task 17; 9.2 Docker → Task 18; 10 tests → every task, plus the contract check in Task 19; 11 error mapping → Task 9 `errorResponse`; 12 privacy → Tasks 7, 8 (scrubbed fixtures), 12.
- **Not in this plan:** everything the browser renders (web plan), `docs/for-sid.md` (web plan, since it links to the finished site), and the gacha follow-up spec.
- **Type consistency checked:** `RouteDeps`, `loaderFor` → `load<T>(key, spec, path, query?)`, `gather`, `ok`, `errorResponse`, `TTL`, `Query`, `UpstreamError`, `NotAllowedError`, `MemoryCacheStore`, `CfCacheStore`, `createApp` return `{ app, cache, upstream, version, deps }`, `registerStatic`, `registerAuthRoutes`, `MeResponse`, `HomeData`, `MetaData`, `StatusResponse`.
