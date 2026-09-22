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

- Railway (community): config in `railway.json`; `npx @railway/cli login` once, then `npx @railway/cli up --detach`.
- Docker (hosted): `docker build -t scr-hub .` and the compose snippet in `docs/for-sid.md`.
