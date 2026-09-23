# SCRmod: search visibility and live stream (design)

Status: approved direction (brainstorm, 2026-09-23). Branch `seo`, off `main` after PR #4.

## Goal

Make scrmod.com findable and shareable. Today Google has not indexed it at all, every URL returns the same
empty HTML titled "SCRmod", `robots.txt` and `sitemap.xml` return the app page, and unknown URLs return 200.
After this work every public page has its own title, description, canonical URL, link preview, structured data
and crawlable content; search-targeted pages exist for the queries people actually type; and the community's
live stream appears on the site.

Realistic targets: the long tail ("rounds ranked", "rounds leaderboard", "rounds competitive", "rounds
<card name>", "rounds card win rate", "how to install rounds mods", "sid's competitive rounds"). The bare word
"Rounds" belongs to Landfall and Steam, and "rounds mods" is led by Thunderstore, a Steam guide, YouTube and
Gamepur; the guide page competes there over time, helped most by backlinks (section 9).

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Player profiles in Google | **Not indexed** (`noindex, follow`), but they get rich link previews for Discord |
| New pages | A **ranked ROUNDS guide** (`/guide`) and **a page per card** (`/cards/:slug`) |
| How crawlers get content | **Server-rendered shell**: per-route head tags plus a light HTML version of the page's key content, rendered by the Node server from the existing caches; React replaces it on load |
| Existing pages | Descriptive titles, descriptions and a one-line intro under the heading on Leaderboards, Results, Tournaments, Cards |
| Live stream | Embed `twitch.tv/sidscompetitiverounds` and YouTube `@SidsCompetitiveRounds` when live, click to play; recent YouTube broadcasts when not |
| Where it's built | Permanent clone `C:\Users\notni\Desktop\Updated\SCR-Hub`, branch `seo` off `main` |

## 1. Architecture

**Shared page metadata (`src/shared/seo.ts`).** Pure functions that turn a route and its data into
`{ title, description, path, index: boolean, og: { type, title, description } }`. Used by the server (head tags,
shells) and by the web app (`useTitle`), so the title in the raw HTML and the title after JavaScript are always
identical. No DOM or Node APIs in this module.

**Server SEO layer (`src/server/seo/`).** Replaces the SPA fallback in `static.ts` for page requests:

1. **Match the route** against the site's routes (home, leaderboards/:mode, results, tournaments,
   tournaments/:id, cards, cards/:slug, guide, about, players/:id). Anything else, a malformed player id, an
   unknown card slug or a malformed tournament id: **status 404** with a "Nothing here" shell and `noindex`.
   A well-formed player or tournament id that Sid's API reports as not found (within the 250 ms below) is also
   a 404; if the API doesn't answer in time the page is served normally (both are `noindex` anyway).
2. **Load the page's data** through the existing `loaderFor(d)` with **the same cache keys the API routes
   use**, so shells never add calls to Sid's API when the API is warm. Each load is raced against a **250 ms**
   timeout; on timeout or error the page renders with generic (data-free) head text and shell, never an error
   page.
3. **Render into the template.** `src/web/index.html` gets two marked regions:
   `<!--seo:head:start-->…<!--seo:head:end-->` (holding today's default title, description and OG tags, so the
   Vite dev server still works) and `<!--seo:body-->` inside `<div id="root">`. The server replaces the head
   region wholesale and fills the body marker with the shell.
4. **Headers.** `Content-Type: text/html`, `Cache-Control: no-cache`, `Vary: Accept-Encoding`, and
   `X-Robots-Tag: noindex, follow` on non-indexed pages. Compressed per request: brotli quality 5 when the
   client accepts it, else gzip level 6. Static assets keep their cached quality-11 copies.

**The shell.** Server-rendered HTML using the site's own classes: the top bar with the wordmark and the five
navigation entries as plain links, the page heading, the intro line, the page's key content (below), links
onward, and the footer. It contains only content the app itself shows after loading (no crawler-only text). It
is replaced by React's first render (`createRoot` inserts new nodes rather than moving old ones, so it isn't
counted as a layout shift). Shell data passes through `scrubPrivate` like every API response.

**Plain endpoints.** `GET /robots.txt` and `GET /sitemap.xml` (section 4).

**Host canonicalisation.** When `PUBLIC_BASE_URL` is set, a GET or HEAD page request whose `Host` differs
(the Railway address, `www.`) is answered with **301** to the same path and query on the canonical origin.
`/api/*`, `/auth/*` and static assets are never redirected (health checks and API clients keep working).

**Server-side redirects.** `/leaderboards` → 301 `/leaderboards/1v1` (replacing the client-side `Navigate`).
`/cards/<name>` where `<name>` is a card's display name or a differently-cased slug → 301 to its canonical slug.

## 2. Pages

Titles lead with "ROUNDS" (search relevance, and it separates SCRmod from the unrelated SKRMOD and ScrMod).
Every title ends ` · SCRmod` except Home's, which starts with it. Descriptions are 120-160 characters, built
from real data where the page has it, and fall back to the fixed text below.

| Route | Title | Indexed | Shell content |
|---|---|---|---|
| `/` | SCRmod: ROUNDS ranked stats, live games and leaderboards | yes | Online count, queue counts, live games (names and score), the 8 latest results, links to boards, cards, guide |
| `/leaderboards/:mode` | ROUNDS {1v1 / 2v2 / FFA / 1v2 / 1v2 solo / 1v2 duo} ranked leaderboard: top players by rating | yes | Intro line, mode links, the top 25 (rank, name, rating) |
| `/results` | ROUNDS match results: latest ranked games | yes | Intro line, the 20 latest results |
| `/tournaments` | ROUNDS tournaments: weekly brackets and winners | yes | Intro line, current sync/async status and signup count, the last 10 winners |
| `/tournaments/:id` | Tournament game details | **no** | Heading and a link back |
| `/cards` | ROUNDS card win rates: the best cards in ranked play | yes | Intro line, every card as a link with win rate and picks |
| `/cards/:slug` | {Card}: ROUNDS card win rate and stats | yes | Card name, rarity, key stats, top winners with it, previous/next card links |
| `/guide` | How to play ranked ROUNDS: install Sid's Competitive Rounds | yes | The full guide text |
| `/about` | About SCRmod and privacy | yes | The page text |
| `/players/:id` | {Name}: ROUNDS ranked stats | **no** | Name, rank tier, rating and a link to the leaderboard |

**Visible copy additions** (one line under the heading):
- Leaderboards: "Ranked ROUNDS players in Sid's Competitive Rounds, ordered by Glicko-2 rating."
- Results: "The latest finished ranked and casual games, newest first."
- Tournaments: "Weekly and async ROUNDS tournaments: signups, brackets and past winners."
- Cards: "Win, pick and pass rates for every ROUNDS card across ranked and casual games."
- Home: a link "New to ranked ROUNDS? Start here →" to `/guide`.
- Footer (every page): "Guide" and "Watch on Twitch · YouTube" links.

### 2.1 The guide (`/guide`)

Written from the mod's README and Thunderstore page (checked 2026-09-23, mod v1.40.3), linking to both.
Sections:
1. **What Sid's Competitive Rounds is**: the ranked mod for ROUNDS, built for the Competitive Rounds Discord.
2. **Before you install**: ROUNDS v1.1.2 (Steam "Default Public Version") only; not compatible with other
   BepInEx mods (it disables itself if it finds any); BepInEx 5.4.1901 is installed for you.
3. **Install with r2modman or Thunderstore Mod Manager**: select ROUNDS, search "Sid's Competitive Rounds",
   install, launch with "Start modded".
4. **Or the Windows installer**: `CompetitiveRoundsInstaller.exe` from the Discord; it finds ROUNDS, installs
   BepInEx and updates itself.
5. **Playing ranked**: F5 opens the overlay; 1v1 and 2v2 on Glicko-2 ladders with best-of-3 series; Free-For-All
   for 3-10 players (first to 5 points); 1v2 as an unranked beta; 25 tiers from Beginner I to Grand Master V.
6. **Tournaments, betting, the shop and achievements** (one paragraph each, two lines).
7. **Controls**: F5 overlay, T chat, Esc close, Tab scoreboard.
8. **Keeping other ROUNDS mods**: use a separate r2modman profile for them.
9. **Links**: Thunderstore, GitHub, Discord, and SCRmod's own leaderboards and cards.

The content lives in one module (`src/web/content/guide.ts`, plain data: headings, paragraphs, lists, links)
rendered by both the React page and the server shell, so the two can't drift.

### 2.2 Card pages (`/cards/:slug`)

**Slug:** the display name lowercased, accents stripped, every run of non-alphanumerics replaced by `-`, dashes
trimmed ("Big Bullet" → `big-bullet`). Resolved against the cached card list; cards below the list's 5-pick
minimum have no page.

**Data:** `GET /api/card/:slug` →
`{ card: CardStat, ranked: CardStat | null, casual: CardStat | null, winners: CardLeader[], sweepers: CardLeader[], prev: {name, slug} | null, next: {name, slug} | null }`,
built from the cached `cards:{all,ranked,casual}:times_picked:desc` and `cards:leaders` loads; `prev`/`next`
follow the "most picked" order. 404 for an unknown slug. Top pickers come from the existing
`/api/cards/:name/pickers`.

**Page:** the heading (card name) and rarity; stat tiles (win rate, picks, offered, pass rate, unique players,
5-0 sweeps) with ranked and casual shown alongside; "Top pickers"; "Most wins with it"; previous/next links and a
link back to all cards. The Cards table's card names become links to these pages (the pickers disclosure stays).
The `index.html` early-fetch script learns `/cards/:slug` → `/card/:slug`.

## 3. Link previews

Every page: `og:site_name` SCRmod, `og:title`, `og:description`, `og:url` (canonical), `og:type` (`website`;
`article` for the guide; `profile` for players), `og:image` the existing `og.png` with width and height,
`twitter:card` `summary_large_image`.

Players: title "{Name}: ROUNDS ranked stats", description "{rating} rating · {tier} · #{standing} of
{population} · {W}-{L} ranked series". Cards: "{Card} · {win rate} win rate in ranked ROUNDS · picked {n} times".

## 4. Crawl rules

**`robots.txt`:**
```
User-agent: *
Allow: /
Disallow: /auth/
Sitemap: {origin}{base}/sitemap.xml
```
Player pages are not blocked here: Google must fetch them to see their `noindex`. `/api/` is not blocked
either: Google renders pages with JavaScript, and the pages fetch their data from it (an earlier version
disallowed it, and Search Console reported `/api/home`, `/api/me` and `/api/stream` as blocked resources).
Every `/api/*` response carries `X-Robots-Tag: noindex` so the JSON is fetched but never indexed.

**`sitemap.xml`:** Home, the 6 leaderboard modes, Results, Tournaments, Cards, every card page, Guide, About.
No player or tournament-detail pages. `<lastmod>` on card pages from their data's `fetched_at`; on Guide and
About from the build. If the card list can't load, the sitemap is served without card pages rather than failing.

**Canonical:** `<link rel="canonical">` to `{origin}{base}{path}` with the query string removed. `origin` is
`PUBLIC_BASE_URL` when set, else the request's origin.

## 5. Structured data (JSON-LD)

- **Every page:** `WebSite` { name "SCRmod", alternateName ["SCR mod", "Sid's Competitive Rounds stats"], url,
  about: [ `VideoGame` "ROUNDS" (sameAs its Steam page), `SoftwareApplication` "Sid's Competitive Rounds"
  (applicationCategory GameApplication; sameAs Thunderstore and GitHub; publisher `Organization` "Sid's
  Competitive Rounds" with sameAs Twitch, YouTube, Discord) ] }.
- **Guide:** `Article` { headline, dateModified, about the mod, publisher SCRmod } plus `BreadcrumbList`.
- **Cards index:** `ItemList` of the card pages. **Card pages:** `BreadcrumbList` (Home › Cards › {Card}).
- **Not used:** FAQPage and HowTo (no rich results since 2023), any list of players.
- **Verification:** optional `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` env vars add their meta
  tags.

## 6. Live stream

**Configuration (env):** `STREAM_TWITCH_LOGIN` (default `sidscompetitiverounds`), `STREAM_YOUTUBE_CHANNEL_ID`
(default `UCz9MIFturPcCSJsFFzgyBxw`), `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` (Twitch live detection),
`YOUTUBE_API_KEY` (optional YouTube live detection).

**`GET /api/stream`** (response cached 60 s, fetched only on demand) →
```
{ live: null | { platform: 'twitch' | 'youtube', title, viewers: number | null, started_at, url,
                 embed: { kind: 'twitch', channel } | { kind: 'youtube', videoId } },
  recent: Array<{ title, url, videoId, published_at }>,   // up to 4, newest first
  links: { twitch, youtube } }
```
- **Twitch:** app token by client credentials (`id.twitch.tv/oauth2/token`), kept in memory, refreshed once on
  401; `GET helix/streams?user_login=…`. Without credentials: Twitch live is always `null`.
- **YouTube:** the public feed `youtube.com/feeds/videos.xml?channel_id=…` (cached 5 min) gives `recent`. With
  `YOUTUBE_API_KEY`, `videos.list?part=liveStreamingDetails,snippet` on the 5 newest ids (1 quota unit per
  check); a video with `actualStartTime` and no `actualEndTime` is live. Twitch wins if both are live.
- Every outside call has a timeout; failures degrade to `live: null` and the last good `recent`.

**On the site:** on Home and Tournaments, when `live` is set, a "Live on stream" card at the top: LIVE pill,
title, viewers, platform, and a play button drawn in the site's style. **No request goes to Twitch or YouTube
until play is pressed**; then the card swaps in the Twitch player
(`player.twitch.tv/?channel=…&parent={location.hostname}`) or YouTube's privacy-enhanced player
(`youtube-nocookie.com/embed/{id}`). When not live, Home shows "Recent broadcasts": the 4 latest videos as
links. The About page gains a line that the stream player comes from Twitch or YouTube once you press play,
and that Google's copy of a page can lag behind in-game deletion.

## 7. Safety, speed, privacy

- **Escaping:** all text into HTML is escaped (`& < > " '`); attributes too; JSON-LD is `JSON.stringify` with
  `<` → `\u003c`. Tests use names such as `</title><script>alert(1)</script>` and `"><img src=x onerror=…>`.
- **Speed:** warm-cache time-to-first-byte grows by under 20 ms; the 250 ms data cap bounds the cold case;
  the stream never blocks a page; the early-fetch script and entry-chunk preload keep working.
- **Privacy:** profile pages `noindex` (meta and header); a deleted player's profile returns 404; the shell
  never shows more than the app shows.

## 8. Testing

Test-first, as in the earlier passes. Server (vitest, fake upstream):
- Head per route: title, description, canonical, robots, OG, JSON-LD shape.
- Status codes: 404 for unknown paths, malformed player ids, unknown slugs and tournament ids; 301 for the
  foreign host, `/leaderboards`, and card aliases.
- `robots.txt` and `sitemap.xml` contents, with and without the card list.
- Escaping with hostile names; the 250 ms fallback; `BASE_PATH`; `X-Robots-Tag`.
- `/api/card/:slug` shape, 404, prev/next.
- `/api/stream`: live and offline on each platform, missing credentials, a 401 refreshed once, quota and
  network errors, the 60 s cache.

Web (Testing Library): the guide renders from its content module; card pages render and an unknown slug shows
not-found; Cards table links to card pages; the live card creates no iframe until play; recent broadcasts show;
`useTitle` titles equal the shared builders'.

Then one browser pass (desktop and phone, both themes), Google's Rich Results Test on the built pages, and a
link-preview check.

## 9. Rollout and owner steps

1. Merge the `seo` PR; on Railway set `PUBLIC_BASE_URL=https://scrmod.com`, the Twitch keys, and optionally
   `YOUTUBE_API_KEY`.
2. Google Search Console: verify scrmod.com (DNS TXT record, or `GOOGLE_SITE_VERIFICATION`) and submit
   `https://scrmod.com/sitemap.xml`. Bing Webmaster Tools: import from Search Console.
3. **Backlinks (largest effect):** scrmod.com as the website on the Thunderstore page and in the GitHub README
   (Sid's); in the Twitch and YouTube channel descriptions; pinned in the Discord.

**Build order.** Sections 1-5 (the SEO layer, guide and card pages) come first. The live stream (section 6) is
independent of them and is built as its own phase; it can ship in the same PR or a follow-up.

## Non-goals

Indexing player profiles; full React server rendering and hydration; per-page generated preview images (a
possible follow-up); FAQ or HowTo markup; lists of players in structured data; translating the site; changing
the visual design (DESIGN.md holds).
