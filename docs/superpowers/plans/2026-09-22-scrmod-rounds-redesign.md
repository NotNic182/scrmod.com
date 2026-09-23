# SCRmod ROUNDS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the SCRmod web app as the ROUNDS "Main menu" look (teal low-poly backdrop, thin uppercase Montserrat, orange selection band, Mist light theme, crowned-character wordmark) without changing behavior.

**Architecture:** Re-skin in place. `tokens.css` gets the new palettes and type families; `base.css` restyles existing classes and adds `.band`; two small new components (`Wordmark`, `Backdrop`) mount in `Layout`. Pages keep their markup. Assets (logo, icons, OG image) are generated once and committed.

**Tech Stack:** React 19 + Vite 8 (root `src/web`, static files from `src/web/public`), plain CSS, Vitest + Testing Library, `@fontsource-variable/montserrat`.

**Spec:** `docs/superpowers/specs/2026-09-22-scrmod-rounds-redesign-design.md`

## Global Constraints

- No route, hook, API, data or copy changes. Pure visual redesign.
- Selection band = "you are here" only: active nav item, active phone tab, viewer's own row, pressed segmented filter, highlighted search result.
- Every text pair ≥ 4.5:1 in dark and Mist, on panel, backdrop and band surfaces.
- Home first-load wire size ≤ 141 KB (today 91 KB + 50 KB).
- Keep all existing accessibility behavior (focus, skip link, aria, reduced motion, rem type scale).
- Storage keys/cookies unchanged (`scrhub.*`).

---

### Task 1: Brand assets

**Files:**
- Create: `src/web/public/logo.webp` (owner's crowned character, alpha)
- Create: `src/web/public/favicon-32.png`, `src/web/public/apple-touch-icon.png` (180px, logo on `#0c3440`)
- Create: `src/web/public/og.png` (1200×630: facets + wordmark + logo)
- Modify: `src/web/index.html` (icon links, `og:image`, `theme-color` `#0c3440`/`#dfeaec`)

- [ ] Copy the supplied logo to `src/web/public/logo.webp`.
- [ ] Generate icons with ffmpeg: `ffmpeg -i logo.webp -vf scale=32:32 favicon-32.png`; apple icon: 180px teal square with the logo scaled to 140px and centered (`-filter_complex` overlay).
- [ ] Render `og.png` from an SVG (backdrop facets + wordmark paths + logo) with `@resvg/resvg-js` run from the scratchpad (not a project dependency).
- [ ] Add to `index.html`: `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<meta property="og:image" content="/og.png">`; theme-color default `#0c3440`, light `#dfeaec` (inline pre-paint script and `lib/theme.ts`).
- [ ] Build: `npm run build:web`; confirm the files land in `dist/web/`.
- [ ] Commit: `git commit -m "Add SCRmod logo, icons and link preview image"`

### Task 2: Wordmark and Backdrop components

**Files:**
- Create: `src/web/components/Wordmark.tsx`, `src/web/components/Backdrop.tsx`
- Test: `tests/web/brand.test.tsx`

**Interfaces:**
- Produces: `Wordmark({ size?: number }): JSX` renders `<span className="wordmark" role="img" aria-label="SCRmod">` containing an inline SVG of outlined "SCRM" + `<img src={BASE + '/logo.webp'} alt="">` + outlined "D". `Backdrop(): JSX` renders `<div className="backdrop" aria-hidden="true"><svg …/></div>`.

- [ ] Write the failing test:

```tsx
import { render, screen } from '@testing-library/react'
import { Wordmark } from '../../src/web/components/Wordmark'
import { Backdrop } from '../../src/web/components/Backdrop'

it('wordmark has one accessible name and the logo image is decorative', () => {
  render(<Wordmark />)
  expect(screen.getByRole('img', { name: 'SCRmod' })).toBeInTheDocument()
  expect(document.querySelector('.wordmark img')).toHaveAttribute('alt', '')
})

it('backdrop is hidden from assistive tech', () => {
  const { container } = render(<Backdrop />)
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
})
```

- [ ] Run `npx vitest run tests/web/brand.test.tsx`: FAIL (modules missing).
- [ ] Generate glyph outlines for "SCRM" and "D" from Fredoka Bold (`@fontsource/fredoka` 700 woff via `opentype.js`, run in the scratchpad), paste the path data into `Wordmark.tsx`; `fill="currentColor"` so CSS colors it `var(--brand)`.
- [ ] Write `Backdrop.tsx`: one `viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"` SVG of ~14 polygons using `fill="var(--facet-light)"` / `fill="var(--facet-dark)"`.
- [ ] Run the test: PASS. Commit: `git commit -m "Add the SCRmod wordmark and faceted backdrop"`

### Task 3: Tokens, fonts and the base restyle

**Files:**
- Modify: `src/web/styles/tokens.css`, `src/web/styles/base.css`, `src/web/main.tsx`, `package.json`

- [ ] `npm i @fontsource-variable/montserrat`; import `@fontsource-variable/montserrat/wght.css` in `main.tsx`.
- [ ] Add a metric-matched fallback: `@font-face { font-family: 'Montserrat Fallback'; src: local('Arial'); size-adjust: 113.39%; ascent-override: 84.95%; descent-override: 22.04%; line-gap-override: 0%; }`; `--font: 'Montserrat Variable', 'Montserrat Fallback', system-ui, sans-serif`.
- [ ] Dark tokens: `--bg #082830`, backdrop gradient `#104250 → #0c3440 → #082830`, `--bg-card rgba(4,22,28,.55)` (panel), `--bg-elev #0a2e37`, `--bg-hover rgba(255,255,255,.06)`, `--fg #eef6f7`, `--fg-muted #a9c4ca`, `--fg-faint #8fb0b7`, `--line rgba(255,255,255,.08)`, `--accent #f08c17`, `--accent-fg #ffffff` on the band (verify ≥ 4.5 with bold/size or darken the band text surface), `--accent-ink #f5a043`, `--brand #f08c17`, `--facet-light rgba(255,255,255,.035)`, `--facet-dark rgba(0,0,0,.09)`, `--topbar #0c3440`. Mist: `--bg #dfeaec`, panel `rgba(255,255,255,.82)`, ink `#0b2a33`, muted `#3f5d65`, faint `#4d6a72`, `--accent-ink #a3530a`, `--topbar #0c3440`, facets `rgba(255,255,255,.45)` / `rgba(12,52,64,.05)`. Keep semantic roles (good/bad/live/info/rare/medals/api lightness band) re-tuned to ≥ 4.5 on the new surfaces.
- [ ] `base.css`: `body` background gradient + `.backdrop` fixed layer; `.card` square panels without border; `h1` 300/uppercase/0.16em; `h2`/`h3`/`th`/`.tile .label` uppercase tracked labels; `.tiles` joined strip; `.band` gradient + facet cuts; `tr.me > td`, `.segmented [aria-pressed=true]`, `.search-option[aria-selected=true]`, `.topnav a.item.active`, `.tabbar a.active` use the band; `.tabs` selected = orange underline; chips square-ish (radius 3px); `.topbar` teal with uppercase thin nav items.
- [ ] Run `npm run typecheck && npx vitest run`: all pass. Commit: `git commit -m "Restyle the app as the ROUNDS main menu"`

### Task 4: Layout wiring, chart colors, theme color

**Files:**
- Modify: `src/web/components/Layout.tsx` (mount `<Backdrop />`, brand link renders `<Wordmark />`), `src/web/components/RatingGraph.tsx` (1v1 `--accent`, grid `--line`), `src/web/lib/theme.ts` (theme-color `#0c3440`/`#dfeaec`), `tests/web/layout.test.tsx`

- [ ] Update the layout test: the home link's accessible name is "SCRmod home"; backdrop present.
- [ ] Implement; run tests; commit: `git commit -m "Mount the wordmark and backdrop in the layout"`

### Task 5: Verification

- [ ] Build, restart preview (`npm run preview`), contrast sweep script across Home, Leaderboards, Player (overview/matches/achievements), Cards, Tournaments, Results, About in dark and Mist: zero pairs < 4.5.
- [ ] Screens at 375px and 1280px, both themes; 125% text; focus visible; no console errors; no horizontal scroll; measure Home first-load wire size ≤ 141 KB.
- [ ] Fix findings in one batch, re-run once, commit, push branch, open PR.
