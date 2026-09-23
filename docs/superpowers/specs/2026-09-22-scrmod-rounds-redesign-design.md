# SCRmod: ROUNDS redesign (design)

Status: approved direction (brainstorm, 2026-09-22). Builds on branch `impeccable-pass` (PR #1).

## Goal

Make the whole site feel like an extension of the game ROUNDS while keeping every function, route, data
flow, accessibility and performance behavior that exists today. Pure visual redesign: no feature changes.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| How close to the game | Game-skinned app: ROUNDS palette, type and signature moves throughout; data stays dense |
| Style direction | **A · Main menu**: thin uppercase type, low-poly teal backdrop, full-width orange selection band |
| Tables | Inside dark translucent **panels** (the band stays within the panel) |
| Light theme | Kept, as **Mist**: pale teal backdrop + facets, top bar stays deep teal |
| Phone navigation | **Bottom tab bar**, game-styled (active tab = orange band) |
| Pride colors | Not used on the site |
| Logo | The crowned ROUNDS character (flag-free, tight crop) supplied by the owner |
| Build approach | **Re-skin in place**: keep components/markup, replace the visual layer, add a few pieces |

## 1. Visual system

**Backdrop.** Dark: radial gradient `#104250 → #0c3440 → #082830` under a fixed full-viewport SVG of low-poly
facets (faint light and dark triangles, 3-9% opacity). Fixed, so content scrolls over it like the game menu.
Mist: `#dfeaec` backdrop, same facet geometry with light/teal tints; top bar stays `#0c3440`.

**Orange band (selection).** Full-width gradient `#e57a0c → #f08c17 → #f59a2c → #e57a0c` with two faint facet
cuts, white text. Means "you are here" only: active desktop nav item, active phone tab, the viewer's own row in
lists/tables, the pressed segmented filter, the highlighted search result. Never decorative.

**Panels.** Square-edged (radius 0-2px), no border, no shadow. Dark: `rgba(4,22,28,.55)`. Mist: `rgba(255,255,255,.82)`.
Stat tiles are one strip with 1px seams. Items inside a panel (live games) use a deeper inset tint, never a
second panel.

**Type.** Montserrat (OFL, self-hosted variable woff2, latin subset). Page titles 28px weight 300, uppercase,
0.16em tracking. Section labels / table headers 11-12px, 300-400, uppercase, 0.14-0.16em. Body 16px 400, data
15px with tabular figures, emphasis 600. Big numbers (tiles, scoreboard) 300 weight at the stat size, like the
game's menu. Existing rem role scale is kept (only families/weights/tracking change).

**Wordmark.** `SCRM` + crowned-character image + `D`: chunky rounded orange lettering (Fredoka Bold, OFL)
outlined to SVG paths at build time and committed as a static asset, so no display font downloads. The
character sits where the O would be, as the ROUNDS logo does with its face.

**Color roles.** Orange `#f08c17` replaces gold as the single brand color (fills, band, active states);
an "orange ink" variant for text on light surfaces. Semantic roles carry over unchanged in meaning: win/good,
loss/bad, info/ranked, LIVE solid red, medals 1-3, rarity, the lightness clamp for game-supplied colors. Every
text pair is re-verified at ≥ 4.5:1 in both themes, on panel, backdrop and band surfaces.

## 2. Structure (what changes where)

- `styles/tokens.css`: new palettes (dark + Mist), orange roles, type families, facet/band tokens.
- `styles/base.css`: restyle of every existing class; add `.band`, facet backdrop, uppercase menu type.
  Existing class names stay so pages need little or no markup change.
- `components/Layout.tsx`: backdrop layer, wordmark in the top bar, nav items as uppercase menu items with
  the band on the active one; tab bar restyled (band on the active tab).
- New `components/Wordmark.tsx` (inline SVG + logo image, accessible name "SCRmod") and
  `components/Backdrop.tsx` (fixed, `aria-hidden`, one SVG, no JS).
- Your-row highlight (`tr.me`, "(you)" list rows) and Segmented/`aria-selected` states switch to the band.
- Tabs strips: thin uppercase labels, orange underline for the selected tab (the band is reserved for
  navigation and "you").
- The rating chart uses orange for 1v1 and the info blue for FFA, redrawn on theme switch as today.
- No route, hook, API, or copy changes. Tab bar labels keep today's text (long ones truncate as they do now).

## 3. Assets and performance

- Logo: owner-supplied PNG/WebP with alpha → `public/logo.webp` (display), `favicon.svg`/`favicon.png`,
  `apple-touch-icon.png` (180px on teal), and a 1200×630 `og.png` (logo + wordmark on the faceted teal).
- Fonts: Montserrat variable latin woff2 (~35 KB), `font-display: swap`, preloaded; fallback metrics tuned
  (`size-adjust`) so the swap doesn't shift layout.
- Backdrop: a single inline SVG, fixed position, no images, no blur.
- Budget: first-load wire size for Home stays within +50 KB of today's 91 KB.

## 4. Testing and verification

- All existing unit/integration tests keep passing; only tests asserting removed visual specifics change.
- New/updated tests: Wordmark has the accessible name "SCRmod"; the viewer's row and active nav carry the
  selection state (via existing aria attributes, not colors).
- Contrast sweep (computed, in the browser) across Home, Leaderboards, Player (overview/matches/achievements),
  Cards, Tournaments, Results, About in dark and Mist: zero pairs under 4.5:1.
- Visual pass at 375px and 1280px in both themes; 125% text size; keyboard focus visible on the new surfaces;
  reduced motion respected; no console errors; no horizontal scroll.

## Out of scope

New features, copy rewrites, a custom display font for headings, animated backdrops, sound, and the
pre-existing `dev:web` proxy issue.
