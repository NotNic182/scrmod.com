# SCR Hub — Design Spec

Date: 2026-09-22
Status: draft for review
Working name: SCR Hub (renaming is a find-and-replace)

## 1. Summary

SCR Hub is a browser companion for Sid's Competitive Rounds (SCR), the ranked mod for ROUNDS. It shows what the in-game F5 menu and the Discord bot show, from any browser including a phone, without launching the game: who is online, live games, leaderboards, player stats, results, tournaments, and card stats.

It is one codebase with two deployment modes:

- **Community mode**: runs on NotNic's own hosting, needs nothing from Sid, read-only.
- **Hosted mode**: the same build runs as a container next to Sid's API and bot, holding a server-side internal key. Account features (Discord sign-in now, gacha pulls later) light up here.

Everything the site displays is data the mod's public API already serves to every mod client and to the Discord bot. The site adds no new data collection.

## 2. Goals

1. A phone-friendly dashboard that replaces "scroll the Discord" for checking who is on and what is happening.
2. A product Sid can adopt with one compose service and two environment variables, so the ask to him is small.
3. A foundation for account features (Discord identity, later gacha) without a redesign.
4. Respect every privacy control the mod offers: appear offline, hide gold, show Discord.
5. Be a good citizen of Sid's single-worker API: cache, coalesce, back off, identify ourselves.

## 3. Non-goals for this spec

- Gacha pulls, mail, shop purchases, chat posting, or any other write to Sid's server. These need server-side changes only Sid can make; see section 14.
- Reproducing ROUNDS card art. Card pages use names and stats only.
- Replacing the Discord bot's bet buttons, tournament signups, or role sync.
- Any use of the mod DLL's signing secret. The site never impersonates the game client for writes.

## 4. Facts about Sid's API that shape the design

Verified on 2026-09-22 against `https://competitive-rounds.duckdns.org:8444` and the v1.40.3 source (`backend/api/main.py` in the mod release folder).

| Fact | Consequence |
|---|---|
| The CORS allow-list is empty (`allow_origins=[]`, main.py:4132). | Browsers cannot call the API from another origin. All calls go through our server. |
| Every `/api/v1/*` request needs `X-Mod-Version` at or above the server's minimum or gets HTTP 426. Verified live: no header gives 426, `1.40.3` gives 200. The minimum is raised at runtime (currently 1.40.3; the code default is 1.38.7). | Our server discovers the current version from `/api/v1/mod-version` (gate-exempt) and re-discovers on any 426. |
| `X-Internal-Key` (the bot's key) bypasses the version gate (main.py:4676). | Hosted mode sends the key instead of a version header. |
| Rate limit: 150 requests per 10 s per client IP, 20 per 10 s on sensitive paths (main.py:4507). | Our server is one IP. It caches, coalesces identical in-flight requests, caps upstream concurrency, and serves stale on 429. |
| The API runs as exactly one uvicorn worker with in-process state (docker-compose.yml). | Never let visitor count translate into upstream request count. |
| Read endpoints need no session token. Writes need a Steam-verified session plus an HMAC made with the DLL's secret (for example `/shop/purchase`, main.py:22878). | Reads are feasible today. Writes are Phase 2 and need Sid. |
| The Discord bot performs gold-spending actions for linked players through internal-key endpoints (`/discord-bets`, main.py:25304). | The server-side pattern for a future web gacha pull already exists. |
| Leaderboard rows carry `is_online` (server-decided, honors appear-offline) and `gold: -1` when hide-gold is on. `/presence/online` excludes appear-offline players. `/players/{id}` returns raw fields: gold, Discord identifiers, `show_discord`, `hide_gold`. | Our server masks profile fields. The frontend never receives what it must not show. |
| Maintenance status (`/admin/maintenance/status`) and active alerts (`/alerts/active`) are public and gate-exempt. | The site shows the same maintenance banner the mod does. |

## 5. Architecture

```
 phone / browser
      |  HTTPS, same origin
      v
 +--------------------------------+
 |  SCR Hub server (Hono, TS)     |   one process, two runtimes:
 |  - serves the static SPA       |   Cloudflare Worker (community)
 |  - /api/* named routes         |   Node in Docker (hosted, Sid)
 |  - cache + request coalescing  |
 |  - privacy masking             |
 |  - Discord OAuth (optional)    |
 +---------------+----------------+
                 |  X-Mod-Version or X-Internal-Key, User-Agent: scr-hub
                 v
     Sid's API  https://competitive-rounds.duckdns.org:8444/api/v1
```

Single package, TypeScript throughout:

```
scr-hub/
  src/server/        Hono app: routes, upstream client, cache, masking, auth
  src/web/           Vite + React SPA
  src/shared/        upstream response types, rank-tier helpers, masking rules
  fixtures/          captured API responses for demo and test mode
  docker/Dockerfile
  wrangler.toml
  docs/
```

The frontend only ever talks to `/api/*` on its own origin. The server is the only component that knows about Sid's API, the version header, or the key.

## 6. Server design

### 6.1 Named routes (the frontend contract)

| Route | Upstream calls | Fresh TTL / stale window |
|---|---|---|
| `GET /api/home` | presence/online, queue/count, team/queue/count, series/active, team/series/active, ffa/lobbies, spectate/games, series/recent-multimode, admin/maintenance/status, alerts/active | 10 s / 60 s. Each upstream item is cached independently; the aggregate returns whatever succeeded plus an `errors[]` list. |
| `GET /api/leaderboard/:mode` for 1v1, 2v2, ffa, 1v2 | leaderboard?limit=500, team/leaderboard, ffa/leaderboard, ovt/leaderboard | 30 s / 120 s |
| `GET /api/results` | series/recent-multimode | 20 s / 120 s |
| `GET /api/players/search?q=` | players/search | 30 s / 120 s |
| `GET /api/players/:id` with optional `?me=` | players/{id}?viewer_steam_id=me, masked per 6.4 | 60 s / 300 s |
| `GET /api/players/:id/matches`, `/team-history`, `/ffa-history`, `/ovt-history`, `/rating-history`, `/achievements`, `/tournaments`, `/team-stats` | the matching player endpoint | 60 s / 300 s |
| `GET /api/players/:id/h2h/:opp` | h2h/{id}/{opp}, players/{id}/vs/{opp}/top-cards | 60 s / 300 s |
| `GET /api/tournaments`, `/api/tournaments/history`, `/api/tournaments/:id` | tournaments router: current, history, history-detail, bracket-detail | 30 s / 300 s |
| `GET /api/cards?filter=` | cards, cards/leaders-summary, cards/top-pickers | 600 s / 3600 s |
| `GET /api/meta` | rank-tiers, achievements/definitions, mod-version, releases/recent | 600 s / 3600 s |
| `GET /api/chat/recent` (behind the `chat` feature flag) | chat/recent | 10 s / 60 s |
| `GET /api/me` | players/by-discord/{id} for the signed-in Discord user | 60 s / 300 s |
| `GET /api/_status` | none | Reports mode, upstream reachability, discovered version, cache stats. |

The server holds an explicit allowlist of upstream paths. Anything not on it cannot be requested, so a bug in a route can never turn the server into an open proxy to admin or internal endpoints.

### 6.2 Upstream client

- Base URL from `SCR_UPSTREAM_BASE`. Default is the DuckDNS HTTPS origin; inside Sid's compose network it is `http://api:8000`.
- Headers: `X-Mod-Version: <discovered>` in community mode, `X-Internal-Key: <key>` in hosted mode, and always `User-Agent: scr-hub/<version> (+<site url>)` so Sid can recognise, rate-limit, or block the site's traffic independently of real mod clients.
- Version discovery: fetch `/api/v1/mod-version` at start and every 10 minutes. On any 426, refresh immediately and retry the request once. `SCR_MOD_VERSION_OVERRIDE` pins it for tests and emergencies.
- Concurrency cap of 8 in-flight upstream requests. Timeout 8 s per request, the same bound the Discord bot uses.
- On 429 or 5xx: serve stale if present, otherwise return 503 with `retry_after`.

### 6.3 Cache

One `CacheStore` interface with two implementations: an in-memory LRU for Node, and the Cache API plus in-isolate memory for Workers. Semantics:

- Fresh within TTL: serve from cache.
- Stale within the stale window: serve immediately and refresh in the background (stale-while-revalidate).
- Beyond the stale window: fetch, with identical concurrent requests coalesced into one upstream call (single-flight).
- Upstream failure: serve stale regardless of age, marked `stale: true` with `fetched_at`, so the UI can say "as of 2 minutes ago".

Every response carries `fetched_at` so the UI can always show data age.

### 6.4 Privacy masking

Applied on the server to every profile-shaped object before it leaves:

- Remove `discord_id` and `discord_username` always.
- Keep `discord_display_name` only when `show_discord` is true.
- Remove `gold_earned`, `gold_spent`, and any derived balance when `hide_gold` is true. Leaderboard rows already arrive with `gold: -1`; the UI renders that as hidden.
- Remove `appear_offline` and `hide_gold` themselves. The settings are private; only their effects are public.
- The profile page never shows an online state. Only leaderboard rows carry `is_online`, and Sid's server decides that.
- Player-private views are never proxied: inventory, bets, blocks, mail, gold sources, card tiers, queue polls.

### 6.5 Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SCR_UPSTREAM_BASE` | `https://competitive-rounds.duckdns.org:8444` | Sid's API origin |
| `SCR_INTERNAL_KEY` | unset | Hosted mode. Sent as `X-Internal-Key`. Never exposed to the browser. |
| `SCR_MOD_VERSION_OVERRIDE` | unset | Pin the version header |
| `SCR_FEATURES` | empty | Comma list of optional features, for example `chat` |
| `BASE_PATH` | `/` | Sub-path when Sid mounts the site under his nginx, for example `/hub/` |
| `PUBLIC_BASE_URL` | derived from the request | Absolute site URL for OAuth redirects and the User-Agent |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` | unset | Presence of all three enables Discord sign-in |
| `SCR_FIXTURES` | unset | Serve responses from `fixtures/` instead of the upstream (demo and tests) |

## 7. Frontend design

### 7.1 Stack

Vite, React, TypeScript, React Router, TanStack Query for polling and caching, a small CSS system with design tokens and no heavy UI kit, uPlot for the rating graph. Mobile-first: the phone is the primary target.

### 7.2 Pages (Phase 1)

1. **Home `/`**: online count and list (name, rating, title), recently online, queue counts for ranked, 2v2 and FFA, live 1v1 series with series score and live points, live 2v2 series, open FFA lobbies with members, spectatable games, and the latest results. Refreshes every 15 s while visible and pauses when the tab is hidden.
2. **Leaderboards `/leaderboards/:mode`**: 1v1 (default), 2v2, FFA, 1v2 solo and duo. Columns: rank, name with title, rank-tier chip in the tier's color, rating, wins and losses, win rate, level, online dot. Client-side search and pagination, a "show inactive" toggle. Refreshes every 60 s.
3. **Player `/players/:steamId`**: header (name, title, tier, rating, peak, level), rating graph over time for 1v1 and FFA, recent form, streaks, accuracy and block rate, top cards, then tabs: 1v1 matches grouped by series with card picks, 2v2, FFA, 1v2, achievements, tournaments. If "me" is set and differs, a head-to-head panel.
4. **Results `/results`**: cross-mode feed of completed series and games.
5. **Tournaments `/tournaments`**: the current sync and async tournaments with state, bracket detail, and history.
6. **Cards `/cards`**: pick counts, win rates, pass rates, a ranked / casual / all filter, top pickers per card.
7. **About `/about`**: where the data comes from, refresh cadence, how to appear offline or hide gold in-game, links to the Discord and Thunderstore, and the project's source.

Phase 1.5, only once Phase 1 lands cleanly: read-only chat scrollback, a compare view with several players on one rating graph, an achievements gallery, release notes.

### 7.3 "Me"

A player can be pinned as "me" two ways: search and pin (stored in `localStorage`), or Discord sign-in, which resolves the linked player through `/api/me`. "Me" drives a nav shortcut to your own profile, head-to-head panels, and highlighting your row on boards. Sign-in is optional everywhere in Phase 1.

### 7.4 Fixture mode

`SCR_FIXTURES=1` makes the server answer from captured JSON in `fixtures/`. The whole site runs with no network. That is how tests run, how the UI is developed, and how Sid can click through a working demo without pointing anything at his server.

### 7.5 Visual direction

Dark by default with a light theme, the rank-tier colors the server sends, bold display type in the spirit of ROUNDS, dense but legible tables on a phone. Decided in detail during implementation with the frontend design skills. The spec fixes only these constraints.

## 8. Discord sign-in

Standard OAuth2 authorization-code flow with the `identify` scope, implemented in the server:

- `GET /auth/discord/login` redirects to Discord. `GET /auth/discord/callback` exchanges the code, then sets an HttpOnly, Secure, SameSite=Lax cookie holding a signed token: Discord user id, username, avatar hash, 30-day expiry. No server-side session store.
- `GET /api/me` returns the Discord identity and the linked SCR player via `players/by-discord/{id}`, or `player: null` with a hint to run the in-game link.
- `POST /auth/logout` clears the cookie.
- The Discord client secret and the session secret never reach the browser.
- Enabled only when the three variables are set. Otherwise the sign-in button is hidden and pinning still works.

This is the identity foundation Phase 2 builds on: a web gacha pull would send the signed-in Discord id to a Sid-side endpoint modeled on `/discord-bets`.

## 9. Deployment

### 9.1 Community mode: Cloudflare Workers with static assets

`wrangler deploy` publishes the server as a Worker and the SPA build as static assets on the same hostname. Static asset requests do not count as Worker invocations. The free tier allows 100,000 Worker requests per day. Home is one aggregate request every 15 s per visible tab, so about seventeen tabs open around the clock would exhaust the free tier. Realistic community use is well under that. If it is ever exceeded, Workers Paid is 5 dollars per month, or the same container runs on any small host.

### 9.2 Hosted mode: Sid's server

A multi-stage `Dockerfile` builds the SPA and the server and runs Node. Sid adds one service to his compose file:

```yaml
  web:
    build: ./scr-hub          # git clone next to the compose file
    restart: unless-stopped
    environment:
      SCR_UPSTREAM_BASE: http://api:8000
      SCR_INTERNAL_KEY: ${API_SECRET_KEY}
      BASE_PATH: /hub/
      PUBLIC_BASE_URL: https://competitive-rounds.duckdns.org:8444/hub
    ports: ["127.0.0.1:8081:8080"]
```

plus one nginx `location /hub/` block proxying to the container. Same origin, so no CORS change is needed. If Sid prefers a distinct key with narrower rights, only the environment value changes.

## 10. Testing

- **Server unit tests (Vitest)**: the allowlist rejects anything off-list; cache fresh, stale-while-revalidate, single-flight and stale-on-error; masking rules for every combination of `hide_gold` and `show_discord`; version discovery and the 426 refresh-and-retry path; Home aggregation with one upstream item failing.
- **Server integration tests**: the Hono app against a fake upstream (another Hono app serving fixtures) asserting headers sent, TTL behaviour with fake timers, and status codes.
- **Frontend tests (Vitest + Testing Library)**: pure components (rank chip, hidden-gold rendering, relative times, series grouping) and page rendering in fixture mode.
- **End-to-end smoke (Playwright, fixture mode)**: home, a leaderboard, a profile, search-and-pin, mobile viewport.
- **Live contract check (manual, on demand)**: a script that hits the real API once per named upstream path and validates the shape against the shared types, so drift in Sid's responses is caught deliberately rather than by users.

## 11. Error handling and degraded states

- Upstream unreachable: pages show cached data with an "as of" age and a banner saying Sid's server is not responding. Nothing crashes on missing fields; every parser tolerates absent keys.
- Maintenance mode or an active alert: a banner mirroring the mod's text.
- 426 after a refresh attempt: a banner saying the site needs an update to talk to the new server version, and `_status` reports it so NotNic hears about it fast.
- Player not found or deleted (404 or 410): a clear empty state, and the pinned "me" is cleared if it was that player.
- Sign-in failure: return to the page with a short message. It never blocks read-only use.

## 12. Privacy and data handling

- The site displays only what the mod's public read endpoints already serve to every mod client and to the Discord bot. It collects nothing new.
- Server-side masking (6.4) is the enforcement point. The frontend is not trusted with private fields.
- Profile caches expire within 60 s, so an in-game "delete my data" or a privacy toggle is reflected quickly.
- No analytics and no third-party scripts. The only cookie is the optional sign-in cookie.
- Discord sign-in stores nothing server-side. The signed cookie is the only state.
- The About page tells players how to appear offline and hide gold, which are the mod's own controls.
- Before any public launch, NotNic presents the site to Sid and asks for his OK. The User-Agent makes the site's traffic identifiable and blockable meanwhile.

## 13. Risks and their resolution

1. **Cloudflare Workers fetch to port 8444.** It is unverified whether a Worker can reach a non-standard port on an external origin. Resolution: the first implementation task deploys a five-line Worker that fetches `/api/v1/health`. If it fails, community mode ships as the Docker image on a small host instead, and nothing else changes.
2. **Sid changes response shapes.** The live contract check catches it. Tolerant parsing means a changed field blanks one widget rather than breaking a page.
3. **Sid raises the minimum mod version.** Handled by version discovery. If a future gate requires something a non-mod client cannot send, hosted mode with the key is unaffected and community mode shows the 426 banner.
4. **Free-tier request budget.** Mitigated by aggregation, the hidden-tab pause, and a 15 s minimum interval. The fallback is the paid plan or a container.
5. **Sid objects to a third-party client.** The design keeps the ask small and the traffic identifiable, and the proposal document asks him directly before launch.

## 14. Out of scope, handled by a follow-up spec

**Gacha and other account actions.** NotNic's playtest DLL contains a gacha card system that is not in the public repo. Pulling from the web requires Sid to add an internal-key endpoint keyed on Discord identity, mirroring `/discord-bets`, and to share the pull, collection and cost rules. When NotNic has described the playtest flow and Sid has confirmed the contract, a second spec covers: the gacha screens (pull, reveal, collection, duplicates), the server routes that call Sid's endpoint with the signed-in Discord id, and a demo mode with mocked pulls so Sid can see the finished screens before building his side.

## 15. Deliverables

1. The `scr-hub` repository: server, SPA, shared types, fixtures, tests, Dockerfile, wrangler config, and a README with a one-command local run in fixture mode.
2. A deployed community instance on NotNic's Cloudflare account, or a container host per risk 1.
3. `docs/for-sid.md`: a one-page proposal covering what the site is, the compose snippet, the three asks (host it or allow the origin, a Discord-identity pull endpoint, a key), and the smaller `/pull` slash-command alternative. Published as a shareable page.
4. This spec, plus the follow-up gacha spec when its inputs exist.
