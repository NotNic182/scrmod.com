# SCRmod

A browser companion for Sid's Competitive Rounds: who is online, live games, leaderboards, player stats, results, tournaments and card stats, from any device, without launching the game. Live at **[scrmod.com](https://scrmod.com)**.

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
| `PUBLIC_BASE_URL` | derived | Absolute site URL for OAuth redirects and canonical links; page requests on other hosts are redirected to it |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` | unset | All three enable Discord sign-in |
| `SCR_FIXTURES` | unset | `1` answers from `fixtures/` (demo, tests) |
| `SCR_FIXTURES_DIR` | `fixtures` | Where fixture mode reads from |
| `SCR_APP_VERSION` | `0.1.0` | Reported by `/api/_status` and sent in the `User-Agent` |
| `SCR_RATE_LIMIT` | on | `off` disables the per-client limit (`/api/*` 60 per 10 s, `/auth/*` 10 per 60 s; `/api/_status` is exempt). Player and tournament pages spend the `/api/*` budget; over it they are served without their data rather than refused |
| `PORT` | `8080` | Node listen port |
| `SCR_WEB_ROOT` | `dist/web` | Directory the built SPA is served from |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | unset | Search console verification meta tags |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | unset | Twitch app credentials: show when the stream is live |
| `YOUTUBE_API_KEY` | unset | Optional: detect a live YouTube stream (recent videos work without it) |
| `STREAM_TWITCH_LOGIN` | `sidscompetitiverounds` | Twitch channel to show |
| `STREAM_YOUTUBE_CHANNEL_ID` | `UCz9MIFturPcCSJsFFzgyBxw` | YouTube channel to show |

`PUBLIC_BASE_URL` may be given with or without `BASE_PATH` on the end (spec 9.2's compose
snippet includes it); it is reduced to an origin either way. `SESSION_SECRET` must be at
least 32 characters or sign-in stays disabled with a warning on startup.

The rate limiter keys on the client address the fronting proxy forwards: the **last** hop of
`X-Forwarded-For` (the element that proxy appended) or `X-Real-IP`. Railway sets this
automatically. A self-hosted nginx must add
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (or
`proxy_set_header X-Real-IP $remote_addr;`) to the `location` block; without it the hub sees no
client address, logs a warning once and does not limit those requests, rather than throttling
every visitor against one shared bucket.

## API (served to the frontend)

`/api/home`, `/api/leaderboard/:mode`, `/api/results`, `/api/results/1v1`, `/api/players/search?q=`, `/api/players/:id`, `/api/players/:id/{matches,matches-summary,rating-history,team-history,ffa-history,ovt-history,team-stats,achievements,tournaments}`, `/api/players/:id/vs/:opp`, `/api/tournaments`, `/api/tournaments/history`, `/api/tournaments/:id/bracket`, `/api/cards`, `/api/cards/leaders`, `/api/cards/:name/pickers`, `/api/chat/recent` (feature `chat`), `/api/meta`, `/api/me`, `/api/_status`.

Data routes answer with `{ data, fetched_at, stale }`. The aggregates (`/api/home`, `/api/meta`,
`/api/tournaments`, `/api/tournaments/history`) add `errors[]`, naming the upstream items that
failed with nothing cached. `/api/me` and `/api/_status` have their own shapes.

## Deploy

- Railway (community): config in `railway.json`; `npx @railway/cli login` once, then `npx @railway/cli up --detach`.
- Docker (hosted): `docker build -t scr-hub .`, plus the compose and nginx snippet in spec section 9.2 (`docs/superpowers/specs/2026-09-22-scr-hub-design.md`).
