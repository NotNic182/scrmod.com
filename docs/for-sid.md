# SCR Hub — a browser companion for Sid's Competitive Rounds

Hi Sid. NotNic here. I built a website that shows what the F5 menu and the bot show — who's online, live games, leaderboards, player pages, results, tournaments, card stats — from any browser or phone, without launching the game. It only reads your public API, the same endpoints the mod and the bot already use, and it honours appear-offline, hide-gold and show-Discord exactly like the game does. Source: <repo link>. Live demo: <site link>.

## How it talks to your server

- One small server (TypeScript) sits between browsers and your API. Browsers never call your API directly.
- It sends `X-Mod-Version` (discovered from `/mod-version`, so raising the minimum never breaks it) and a `User-Agent` of `scr-hub/<version>`, so you can spot or block its traffic any time.
- It caches every response (10 s for live data, 30–60 s for boards and profiles, 10 min for reference data), coalesces identical requests, caps itself at 8 in-flight requests, and serves stale data if you're down. A hundred people looking at the site costs your API about the same as one mod client.
- It never touches player-private endpoints (inventory, bets, mail, card tiers, queue polls) and it strips Discord ids and hidden gold server-side.

## If you want to host it yourself (optional)

It's one container. Next to `api` and `bot` in your compose file:

