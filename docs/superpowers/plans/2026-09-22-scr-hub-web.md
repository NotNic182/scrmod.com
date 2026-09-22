# SCR Hub Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SCR Hub frontend: a mobile-first React single-page app that renders Home, Leaderboards, Player, Results, Tournaments, Cards and About from the `/api/*` contract of the server plan, with a pinned or Discord-signed-in "me", fixture-mode demos, and an end-to-end smoke suite; plus the proposal document for Sid.

**Architecture:** Vite + React + TypeScript under `src/web`, served by the server from `dist/web`. Data flows only through `hubGet()` → TanStack Query hooks → pages; every page wraps its query in `QueryState`, which owns loading, error and data-age rendering (spec 11). Small presentational primitives (`PlayerLink`, `RankChip`, `StatTile`, `Tabs`, …) are shared by all pages. "Me" is a `useIdentity()` hook that merges a `localStorage` pin with the optional Discord session.

**Tech Stack:** React 19, react-router 7, @tanstack/react-query 5, uPlot (rating graph), Vite 7, Vitest 3 + Testing Library + jsdom, Playwright, cross-env. Prerequisite: the server plan (`2026-09-22-scr-hub-server.md`) is complete on `main`.

**Spec:** `docs/superpowers/specs/2026-09-22-scr-hub-design.md` — sections 7, 8 (client side), 9, 10, 11, 12, 15.

## Global Constraints

- The browser talks only to its own origin: `hubGet(path)` prefixes `import.meta.env.BASE_URL` + `api`; never call Sid's API directly (spec 5).
- Every hub response is `{ data, fetched_at, stale }`; pages must render `stale` and `fetched_at` through `DataAge` (spec 6.3, 11).
- Polling: Home 15 s, boards 60 s, player pages 60 s, results 30 s, meta and cards 10 min; `refetchIntervalInBackground: false` everywhere so hidden tabs stop polling (spec 7.2, 9.1).
- Never render `discord_id`, `discord_username`, `hide_gold`, `appear_offline`; render `gold_hidden: true` and `gold: -1` as "hidden" (spec 6.4). Never show an online state on a profile page.
- Mobile-first: everything works at 375 px wide with no horizontal page scroll; touch targets at least 40 px tall.
- No third-party scripts, fonts or analytics; system font stack; dark theme by default with a light theme via `data-theme` on `<html>` (spec 7.5, 12).
- Percentages: `win_rate` on 1v1, 2v2 and FFA boards is a 0–1 fraction; on the 1v2 board it is already a percent (81.2).
- Tolerant rendering: every field access on upstream data uses optional chaining or a default; a missing field blanks one widget, never a page (spec 11).
- Tests use a mocked `fetch` (`mockHub`) and the captured `fixtures/`; Playwright runs against the server in fixture mode. No test touches the live API.
- Commit after every task with the message shown. No attribution lines in commit messages.

---

### Task 1: Frontend scaffold, API client and format helpers

**Files:**
- Create: `vite.config.ts`, `src/web/index.html`, `src/web/main.tsx`, `src/web/App.tsx`, `src/web/vite-env.d.ts`
- Create: `src/web/api/client.ts`, `src/web/lib/format.ts`
- Modify: `vitest.config.ts` (add the `web` project), `package.json` (scripts, deps), `tsconfig.json` (no change needed; `jsx: react-jsx` is already set)
- Create: `tests/web/setup.ts`, `tests/web/helpers/render.tsx`, `tests/web/helpers/mockHub.ts`
- Test: `tests/web/format.test.ts`, `tests/web/client.test.ts`

**Interfaces:**
- Produces: `hubGet<T>(path: string): Promise<T>`, `hubPost<T>(path: string): Promise<T>`, `class HubError { status: number; body: unknown }`, `BASE` (base path without trailing slash, `''` for root).
- Produces: `relTime(iso, now?)`, `pct(fraction, digits?)`, `signed(n, digits?)`, `fmtDate(iso, now?)`, `clock(seconds)`, `num(n)`, `goldText(gold, hidden)`.
- Produces (test helpers): `renderApp(ui, { route? })`, `mockHub(routes: Record<string, unknown | (() => Response)>)`, `env(data, extra?)` building a hub envelope.

- [ ] **Step 1: Install dependencies**

```bash
npm install react react-dom react-router @tanstack/react-query uplot
npm install -D vite @vitejs/plugin-react @types/react @types/react-dom jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event cross-env
npm pkg set scripts.dev:web="vite" scripts.dev:fixtures="cross-env SCR_FIXTURES=1 tsx watch src/server/node.ts" scripts.build:web="vite build" scripts.build="npm run build:web && npm run build:server" scripts.preview="cross-env SCR_FIXTURES=1 node dist/server/node.js"
```

- [ ] **Step 2: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/web',
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: { outDir: '../../dist/web', emptyOutDir: true, sourcemap: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080', '/auth': 'http://localhost:8080' },
  },
})
```

- [ ] **Step 3: Extend `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'server', environment: 'node', include: ['tests/server/**/*.test.ts'] },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['tests/web/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/web/setup.ts'],
          css: false,
        },
      },
    ],
  },
})
```

- [ ] **Step 4: Write the failing tests**

`tests/web/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

`tests/web/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { relTime, pct, signed, fmtDate, clock, num, goldText } from '../../src/web/lib/format'

const NOW = Date.parse('2026-09-22T12:00:00Z')

describe('format', () => {
  it('relTime', () => {
    expect(relTime('2026-09-22T11:59:58Z', NOW)).toBe('just now')
    expect(relTime('2026-09-22T11:59:20Z', NOW)).toBe('40s ago')
    expect(relTime('2026-09-22T11:47:00Z', NOW)).toBe('13m ago')
    expect(relTime('2026-09-22T09:00:00Z', NOW)).toBe('3h ago')
    expect(relTime('2026-09-19T12:00:00Z', NOW)).toBe('3d ago')
    expect(relTime(null, NOW)).toBe('')
    expect(relTime('garbage', NOW)).toBe('')
  })
  it('pct and signed', () => {
    expect(pct(0.4935)).toBe('49%')
    expect(pct(0.9877, 1)).toBe('98.8%')
    expect(pct(undefined)).toBe('–')
    expect(signed(8.9, 1)).toBe('+8.9')
    expect(signed(-110.2)).toBe('-110')
    expect(signed(0)).toBe('0')
    expect(signed(null)).toBe('–')
  })
  it('fmtDate, clock, num, goldText', () => {
    expect(fmtDate('2026-09-21T07:17:22Z', NOW)).toBe('Sep 21')
    expect(fmtDate('2025-12-01T00:00:00Z', NOW)).toBe('Dec 1, 2025')
    expect(clock(281)).toBe('4:41')
    expect(clock(0)).toBe('0:00')
    expect(num(31818)).toBe('31,818')
    expect(goldText(31818, false)).toBe('31,818g')
    expect(goldText(-1, false)).toBe('hidden')
    expect(goldText(5, true)).toBe('hidden')
    expect(goldText(undefined, false)).toBe('–')
  })
})
```

`tests/web/helpers/mockHub.ts`:

```ts
import { vi } from 'vitest'

export type HubRoutes = Record<string, unknown | (() => Response)>

export function env<T>(data: T, extra: Record<string, unknown> = {}) {
  return { data, fetched_at: new Date().toISOString(), stale: false, ...extra }
}

/** Replaces global fetch. Keys are hub paths without the /api prefix, e.g. '/home', '/leaderboard/1v1'. */
export function mockHub(routes: HubRoutes) {
  const calls: string[] = []
  const impl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://localhost')
    const key = url.pathname.replace(/^\/api/, '') + (url.search ? url.search : '')
    calls.push(key)
    const exact = routes[key] ?? routes[url.pathname.replace(/^\/api/, '')]
    if (exact === undefined) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    if (typeof exact === 'function') return (exact as () => Response)()
    return new Response(JSON.stringify(exact), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  globalThis.fetch = impl as unknown as typeof fetch
  return { calls, impl }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
```

`tests/web/helpers/render.tsx`:

```tsx
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router'

export function renderApp(ui: ReactNode, opts: { route?: string; path?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false, staleTime: 0 } } })
  const route = opts.route ?? '/'
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        {opts.path ? (
          <Routes>
            <Route path={opts.path} element={ui} />
          </Routes>
        ) : (
          ui
        )}
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
```

`tests/web/client.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hubGet, HubError } from '../../src/web/api/client'
import { mockHub, env, jsonResponse } from './helpers/mockHub'

describe('hubGet', () => {
  it('prefixes /api and parses the envelope', async () => {
    const { calls } = mockHub({ '/home': env({ ok: true }) })
    const body = await hubGet<{ data: { ok: boolean } }>('/home')
    expect(body.data.ok).toBe(true)
    expect(calls[0]).toBe('/home')
  })

  it('throws HubError with the status and body on non-2xx', async () => {
    mockHub({ '/players/1': () => jsonResponse({ error: 'not_found' }, 404) })
    const err = await hubGet('/players/1').catch((e) => e)
    expect(err).toBeInstanceOf(HubError)
    expect(err.status).toBe(404)
    expect(err.body).toEqual({ error: 'not_found' })
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run --project web` — expected FAIL (modules not found).

- [ ] **Step 6: Write `src/web/api/client.ts`**

```ts
export class HubError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`hub responded ${status}`)
    this.name = 'HubError'
  }
}

/** Base path without trailing slash: '' at the root, '/hub' under BASE_PATH=/hub. */
export const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    credentials: 'same-origin',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new HubError(res.status, body)
  return body as T
}

export function hubGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function hubPost<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'POST' })
}

/** Auth endpoints live beside /api, not under it. */
export function authUrl(path: string): string {
  return `${BASE}/auth${path}`
}
```

- [ ] **Step 7: Write `src/web/lib/format.ts`**

```ts
export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function pct(fraction: number | null | undefined, digits = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '–'
  return `${(fraction * 100).toFixed(digits)}%`
}

export function signed(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  const fixed = n.toFixed(digits)
  return n > 0 ? `+${fixed}` : fixed
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const label = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return d.getUTCFullYear() === new Date(now).getUTCFullYear() ? label : `${label}, ${d.getUTCFullYear()}`
}

export function clock(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  return n.toLocaleString('en-US')
}

export function goldText(gold: number | null | undefined, hidden: boolean): string {
  if (hidden || gold === -1) return 'hidden'
  if (gold === null || gold === undefined) return '–'
  return `${num(gold)}g`
}
```

- [ ] **Step 8: Write the app entry files**

`src/web/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`src/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="dark light" />
    <title>SCR Hub</title>
    <meta name="description" content="Sid's Competitive Rounds from your browser: who is online, live games, leaderboards and stats." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

`src/web/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/web/App.tsx` (Task 2 fills in the routes; for now a placeholder that compiles):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { BASE } from './api/client'

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, refetchIntervalInBackground: false } },
})

export function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter basename={BASE || '/'}>
        <Routes>
          <Route path="*" element={<h1>SCR Hub</h1>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

Create empty `src/web/styles/tokens.css` and `src/web/styles/base.css` (filled in Task 2) so the imports resolve.

- [ ] **Step 9: Run the tests and build**

Run: `npx vitest run --project web` — expected PASS (format + client). `npm run build:web` — expected: `dist/web/index.html` and `dist/web/assets/*.js`. `npm run typecheck` — clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold the web app with API client, format helpers and test harness"
```

---

### Task 2: App shell, theme, layout and query-state primitives

**Files:**
- Create: `src/web/styles/tokens.css`, `src/web/styles/base.css`
- Create: `src/web/components/Layout.tsx`, `src/web/components/QueryState.tsx`, `src/web/components/DataAge.tsx`, `src/web/components/EmptyState.tsx`, `src/web/lib/theme.ts`
- Create: `src/web/pages/NotFound.tsx`
- Modify: `src/web/App.tsx` (routes with placeholders for pages added later)
- Test: `tests/web/layout.test.tsx`, `tests/web/queryState.test.tsx`

**Interfaces:**
- Produces: `<Layout />` (nav + `<Outlet />`), `<QueryState q={query} label="…" empty?={…}>{(data) => node}</QueryState>` where `q` is a TanStack `UseQueryResult<{ data: T; fetched_at: string; stale: boolean; errors?: string[] }>`, `<DataAge fetchedAt stale />`, `<EmptyState title hint? />`, `useTheme(): { theme: 'dark' | 'light'; toggle(): void }`.

- [ ] **Step 1: Write the failing tests**

`tests/web/layout.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { renderApp } from './helpers/render'
import { mockHub } from './helpers/mockHub'
import { Layout } from '../../src/web/components/Layout'

describe('Layout', () => {
  it('renders the primary navigation and the page outlet', () => {
    mockHub({ '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>page body</p>} />
        </Route>
      </Routes>,
    )
    for (const label of ['Home', 'Boards', 'Results', 'Tournaments', 'Cards']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByText('page body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })
})
```

`tests/web/queryState.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { renderApp } from './helpers/render'
import { mockHub, env, jsonResponse } from './helpers/mockHub'
import { hubGet } from '../../src/web/api/client'
import { QueryState } from '../../src/web/components/QueryState'

function Probe({ path }: { path: string }) {
  const q = useQuery({ queryKey: [path], queryFn: () => hubGet<{ data: { items: string[] }; fetched_at: string; stale: boolean }>(path) })
  return (
    <QueryState q={q} label="things" empty={(d) => d.items.length === 0}>
      {(d) => <ul>{d.items.map((i) => <li key={i}>{i}</li>)}</ul>}
    </QueryState>
  )
}

describe('QueryState', () => {
  it('shows a loading state, then the data with its age', async () => {
    mockHub({ '/things': env({ items: ['a', 'b'] }) })
    renderApp(<Probe path="/things" />)
    expect(screen.getByText(/loading things/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('a')).toBeInTheDocument())
    expect(screen.getByText(/just now/)).toBeInTheDocument()
  })

  it('shows the stale marker', async () => {
    mockHub({ '/things': env({ items: ['a'] }, { stale: true, fetched_at: new Date(Date.now() - 120_000).toISOString() }) })
    renderApp(<Probe path="/things" />)
    await waitFor(() => expect(screen.getByText(/as of 2m ago/)).toBeInTheDocument())
    expect(screen.getByText(/may be out of date/i)).toBeInTheDocument()
  })

  it('shows a friendly error for 503 and 404', async () => {
    mockHub({ '/things': () => jsonResponse({ error: 'upstream_unreachable' }, 503) })
    renderApp(<Probe path="/things" />)
    await waitFor(() => expect(screen.getByText(/Sid's server isn't responding/i)).toBeInTheDocument())
  })

  it('renders the empty state', async () => {
    mockHub({ '/things': env({ items: [] }) })
    renderApp(<Probe path="/things" />)
    await waitFor(() => expect(screen.getByText(/no things/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project web` — expected FAIL (missing components).

- [ ] **Step 3: Write the styles**

`src/web/styles/tokens.css`:

```css
:root {
  --bg: #0e1016;
  --bg-elev: #151823;
  --bg-card: #1b1f2c;
  --bg-hover: #222738;
  --fg: #eceef4;
  --fg-muted: #98a1b3;
  --fg-faint: #6b7385;
  --line: #2a3042;
  --accent: #ffcc33;
  --accent-fg: #15171d;
  --good: #55d846;
  --bad: #ff5c5c;
  --live: #ff3b3b;
  --info: #77a3fc;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  --font: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --nav-h: 56px;
  --gutter: 16px;
  --maxw: 1100px;
  color-scheme: dark;
}

:root[data-theme='light'] {
  --bg: #f4f5f9;
  --bg-elev: #ffffff;
  --bg-card: #ffffff;
  --bg-hover: #eef0f6;
  --fg: #171a22;
  --fg-muted: #4f5666;
  --fg-faint: #8a92a3;
  --line: #dde1ea;
  --accent: #d99a00;
  --accent-fg: #ffffff;
  --shadow: 0 8px 24px rgba(20, 24, 40, 0.1);
  color-scheme: light;
}
```

`src/web/styles/base.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.45;
  -webkit-text-size-adjust: 100%;
}
a {
  color: inherit;
  text-decoration: none;
}
button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
h1,
h2,
h3 {
  margin: 0 0 8px;
  line-height: 1.2;
  letter-spacing: -0.01em;
}
h1 {
  font-size: 26px;
  font-weight: 800;
}
h2 {
  font-size: 18px;
  font-weight: 700;
}
h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.page {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 16px var(--gutter) 40px;
}
.card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 14px;
}
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 760px) {
  .grid-2 {
    grid-template-columns: 1fr 1fr;
  }
}
.muted {
  color: var(--fg-muted);
}
.faint {
  color: var(--fg-faint);
}
.good {
  color: var(--good);
}
.bad {
  color: var(--bad);
}
.mono {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--bg-elev);
  font-weight: 600;
}
.btn:hover {
  background: var(--bg-hover);
}
.btn-accent {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: transparent;
}
.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
}
.input {
  min-height: 40px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--bg-elev);
  color: var(--fg);
  font: inherit;
  width: 100%;
}

/* Responsive table: horizontal scroll inside the card, never the page. */
.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -14px;
  padding: 0 14px;
}
table.t {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
table.t th,
table.t td {
  padding: 8px 8px;
  text-align: left;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
table.t th {
  font-size: 12px;
  font-weight: 700;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
table.t td.num,
table.t th.num {
  text-align: right;
}
table.t tr.me {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
table.t tbody tr:hover {
  background: var(--bg-hover);
}

.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 var(--gutter);
  background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  white-space: nowrap;
}
.nav .brand {
  font-weight: 900;
  letter-spacing: -0.02em;
  margin-right: 8px;
  color: var(--accent);
}
.nav a.item {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  color: var(--fg-muted);
}
.nav a.item.active {
  color: var(--fg);
  background: var(--bg-hover);
}
.footer {
  padding: 24px var(--gutter);
  text-align: center;
  font-size: 12px;
  color: var(--fg-faint);
}

.banner {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  font-weight: 600;
}
.banner.warn {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
}
.banner.bad {
  background: color-mix(in srgb, var(--bad) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--bad) 50%, transparent);
}
.age {
  font-size: 12px;
  color: var(--fg-faint);
  margin-top: 8px;
}
.skeleton {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--bg-elev), var(--bg-hover), var(--bg-elev));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
  margin: 6px 0;
}
@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
.empty {
  padding: 24px;
  text-align: center;
  color: var(--fg-muted);
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fg-faint);
  margin-right: 6px;
  vertical-align: middle;
}
.dot.on {
  background: var(--good);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--good) 25%, transparent);
}
.live-pill {
  background: var(--live);
  color: white;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
@media (min-width: 560px) {
  .tiles {
    grid-template-columns: repeat(4, 1fr);
  }
}
.tile {
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.tile .label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-faint);
}
.tile .value {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}
.tile .sub {
  font-size: 12px;
  color: var(--fg-muted);
}
.tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.tabs button {
  min-height: 40px;
  padding: 0 12px;
  font-weight: 600;
  color: var(--fg-muted);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.tabs button[aria-selected='true'] {
  color: var(--fg);
  border-bottom-color: var(--accent);
}
.form-w {
  display: inline-block;
  width: 10px;
  text-align: center;
  font-weight: 800;
}
.form-w.w {
  color: var(--good);
}
.form-w.l {
  color: var(--bad);
}
```

- [ ] **Step 4: Write `src/web/lib/theme.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'scrhub.theme'

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // storage unavailable
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}
```

- [ ] **Step 5: Write the components**

`src/web/components/DataAge.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { relTime } from '../lib/format'

export function DataAge({ fetchedAt, stale }: { fetchedAt: string; stale: boolean }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="age">
      as of {relTime(fetchedAt)}
      {stale ? ' · may be out of date' : ''}
    </div>
  )
}
```

`src/web/components/EmptyState.tsx`:

```tsx
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div>{title}</div>
      {hint ? <div className="faint">{hint}</div> : null}
    </div>
  )
}
```

`src/web/components/QueryState.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { HubError } from '../api/client'
import { DataAge } from './DataAge'
import { EmptyState } from './EmptyState'

export interface Enveloped<T> {
  data: T
  fetched_at: string
  stale: boolean
  errors?: string[]
}

export function errorText(err: unknown): string {
  if (err instanceof HubError) {
    const code = (err.body as { error?: string } | null)?.error
    if (err.status === 404) return 'Not found.'
    if (code === 'upstream_version_gate') return 'The site needs an update to talk to the new server version.'
    if (code === 'upstream_rate_limited') return "Sid's server is busy. Retrying shortly."
    if (err.status === 503 || err.status === 502) return "Sid's server isn't responding. Showing what we have."
    return `Something went wrong (${err.status}).`
  }
  return "Can't reach the hub. Check your connection."
}

interface Props<T> {
  q: UseQueryResult<Enveloped<T>>
  label: string
  empty?: (data: T) => boolean
  emptyHint?: string
  children: (data: T, meta: { fetched_at: string; stale: boolean; errors: string[] }) => ReactNode
}

export function QueryState<T>({ q, label, empty, emptyHint, children }: Props<T>) {
  if (q.isPending) {
    return (
      <div aria-busy="true">
        <span className="faint">Loading {label}…</span>
        <div className="skeleton" style={{ width: '70%' }} />
        <div className="skeleton" style={{ width: '90%' }} />
        <div className="skeleton" style={{ width: '60%' }} />
      </div>
    )
  }
  if (q.isError && !q.data) {
    return <div className="banner bad">{errorText(q.error)}</div>
  }
  const body = q.data!
  if (empty && empty(body.data)) return <EmptyState title={`No ${label} right now.`} hint={emptyHint} />
  return (
    <>
      {q.isError ? <div className="banner bad">{errorText(q.error)}</div> : null}
      {children(body.data, { fetched_at: body.fetched_at, stale: body.stale, errors: body.errors ?? [] })}
      <DataAge fetchedAt={body.fetched_at} stale={body.stale} />
    </>
  )
}
```

`src/web/components/Layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useTheme } from '../lib/theme'

const NAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Home', end: true },
  { to: '/leaderboards/1v1', label: 'Boards' },
  { to: '/results', label: 'Results' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/cards', label: 'Cards' },
]

export function Layout({ identity }: { identity?: ReactNode }) {
  const { theme, toggle } = useTheme()
  return (
    <>
      <nav className="nav" aria-label="Primary">
        <NavLink to="/" className="brand" end>
          SCR Hub
        </NavLink>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `item${isActive ? ' active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
        <span className="spacer" />
        {identity}
        <button className="btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </nav>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">
        Data from the Sid's Competitive Rounds mod API, refreshed every few seconds. Not affiliated with Landfall.{' '}
        <NavLink to="/about">About &amp; privacy</NavLink>
      </footer>
    </>
  )
}
```

`src/web/pages/NotFound.tsx`:

```tsx
import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="card">
      <h1>Nothing here</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link className="btn" to="/">
        Back home
      </Link>
    </div>
  )
}
```

- [ ] **Step 6: Wire the routes in `src/web/App.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BASE } from './api/client'
import { Layout } from './components/Layout'
import { NotFound } from './pages/NotFound'

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, refetchIntervalInBackground: false } },
})

// Pages are added by later tasks; until then each route renders NotFound.
const Placeholder = NotFound

export function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter basename={BASE || '/'}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Placeholder />} />
            <Route path="leaderboards" element={<Navigate to="/leaderboards/1v1" replace />} />
            <Route path="leaderboards/:mode" element={<Placeholder />} />
            <Route path="players/:steamId" element={<Placeholder />} />
            <Route path="results" element={<Placeholder />} />
            <Route path="tournaments" element={<Placeholder />} />
            <Route path="tournaments/:id" element={<Placeholder />} />
            <Route path="cards" element={<Placeholder />} />
            <Route path="about" element={<Placeholder />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS. `npm run typecheck` — clean. `npm run build:web` — builds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add app shell, theme, layout and query-state primitives"
```

---

### Task 3: Player primitives and data hooks

**Files:**
- Create: `src/web/components/PlayerLink.tsx`, `src/web/components/RankChip.tsx`, `src/web/components/TitleTag.tsx`, `src/web/components/StatTile.tsx`, `src/web/components/Tabs.tsx`, `src/web/components/FormStrip.tsx`
- Create: `src/web/api/hooks.ts`, `src/web/api/types.ts`
- Test: `tests/web/primitives.test.tsx`, `tests/web/hooks.test.tsx`

**Interfaces:**
- Produces components: `<PlayerLink steamId name title? titleColor? online? me? />`, `<RankChip name? color? rating? tiers? />`, `<TitleTag title color />`, `<StatTile label value sub? tone? />`, `<Tabs tabs={[{id,label}]} value onChange />`, `<FormStrip form={FormEntry[]} />`.
- Produces hooks (all return TanStack query results whose `data` is the hub envelope): `useHome()`, `useLeaderboard(mode, inactive)`, `usePlayer(steamId, me)`, `usePlayerSub<T>(steamId, sub, params?)`, `useVs(steamId, opp)`, `useResults(limit?)`, `useResults1v1(limit?)`, `useTournaments()`, `useTournamentHistory()`, `useBracket(id)`, `useCards(filter, sort, order)`, `useCardLeaders()`, `useCardPickers(name)`, `useMeta()`, `useMe()`, `useSearch(q)`, `useStatus()`.
- Produces types (`src/web/api/types.ts`): `Env<T>`, `HomeEnvelope`, `MetaEnvelope`, `MeResponse` re-exported from `src/shared/hub-types.ts`; `AnyBoard` union; `TournamentsResponse`, `TournamentHistoryResponse`, `CardLeadersResponse`.

- [ ] **Step 1: Write the failing tests**

`tests/web/primitives.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { PlayerLink } from '../../src/web/components/PlayerLink'
import { RankChip } from '../../src/web/components/RankChip'
import { StatTile } from '../../src/web/components/StatTile'
import { FormStrip } from '../../src/web/components/FormStrip'

describe('primitives', () => {
  it('PlayerLink links to the profile and shows the title in its color', () => {
    renderApp(<PlayerLink steamId="76561198040410653" name="Sid" title="FFA 1st Place" titleColor="#FFD700" online />)
    const link = screen.getByRole('link', { name: /Sid/ })
    expect(link).toHaveAttribute('href', '/players/76561198040410653')
    expect(screen.getByText('FFA 1st Place')).toHaveStyle({ color: 'rgb(255, 215, 0)' })
    expect(screen.getByLabelText('online')).toBeInTheDocument()
  })

  it('RankChip uses the server name and color when given, else derives the tier from the rating', () => {
    renderApp(<RankChip name="Grand Master IV" color="#E52745" />)
    expect(screen.getByText('Grand Master IV')).toHaveStyle({ borderColor: 'rgb(229, 39, 69)' })
    renderApp(<RankChip rating={1700} />)
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('StatTile and FormStrip render', () => {
    renderApp(<StatTile label="Rating" value="1102" sub="peak 1338" />)
    expect(screen.getByText('Rating')).toBeInTheDocument()
    expect(screen.getByText('1102')).toBeInTheDocument()
    renderApp(<FormStrip form={[{ result: 'W', ranked: true, opponent: 'A', score: '5-2', date: '2026-09-21' }, { result: 'L', ranked: false, opponent: 'B', score: '3-5', date: '2026-09-20' }]} />)
    expect(screen.getAllByText('W').length).toBe(1)
    expect(screen.getAllByText('L').length).toBe(1)
  })
})
```

`tests/web/hooks.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { mockHub, env } from './helpers/mockHub'
import { useLeaderboard, usePlayer, useSearch } from '../../src/web/api/hooks'

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('hooks', () => {
  it('useLeaderboard builds the path with the inactive flag', async () => {
    const { calls } = mockHub({ '/leaderboard/2v2?inactive=1': env({ entries: [], total_players: 0 }) })
    const { result } = renderHook(() => useLeaderboard('2v2', true), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(calls[0]).toBe('/leaderboard/2v2?inactive=1')
  })

  it('usePlayer passes me only when it differs and is disabled without an id', async () => {
    const { calls } = mockHub({ '/players/76561199311926326?me=76561198040410653': env({ display_name: 'NotNic' }) })
    const { result } = renderHook(() => usePlayer('76561199311926326', '76561198040410653'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(calls[0]).toBe('/players/76561199311926326?me=76561198040410653')
    const { result: same } = renderHook(() => usePlayer('76561199311926326', '76561199311926326'), { wrapper: wrapper() })
    await waitFor(() => expect(same.current.isSuccess).toBe(true))
    expect(calls[1]).toBe('/players/76561199311926326')
    const { result: off } = renderHook(() => usePlayer(undefined, null), { wrapper: wrapper() })
    expect(off.current.fetchStatus).toBe('idle')
  })

  it('useSearch is idle for an empty query and encodes the term', async () => {
    const { calls } = mockHub({ '/players/search?q=nic%20t': env({ results: [] }) })
    const { result: idle } = renderHook(() => useSearch('  '), { wrapper: wrapper() })
    expect(idle.current.fetchStatus).toBe('idle')
    const { result } = renderHook(() => useSearch('nic t'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(calls[0]).toBe('/players/search?q=nic%20t')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project web` — expected FAIL.

- [ ] **Step 3: Write `src/web/api/types.ts`**

```ts
import type {
  BracketDetail,
  CardStat,
  CardTopPickers,
  FfaLeaderboard,
  Leaderboard,
  MultimodeRecent,
  OvtLeaderboard,
  PlayerSearch,
  RecentSeries,
  TeamLeaderboard,
  TournamentCurrent,
  TournamentHistoryDetail,
  TournamentHistoryRow,
} from '../../shared/api-types'
import type { CardLeader } from '../../server/routes/cards'

export type { HomeEnvelope, MetaEnvelope, MeResponse, HubProfile, StatusResponse } from '../../shared/hub-types'

export interface Env<T> {
  data: T
  fetched_at: string
  stale: boolean
  errors?: string[]
}

export type AnyBoard = Leaderboard | TeamLeaderboard | FfaLeaderboard | OvtLeaderboard
export type BoardMode = '1v1' | '2v2' | 'ffa' | '1v2' | '1v2-solo' | '1v2-duo'

export type ResultsResponse = Env<MultimodeRecent>
export type Results1v1Response = Env<{ series: Array<Omit<RecentSeries, 'p1_discord_id' | 'p2_discord_id'>> }>
export type SearchResponse = Env<PlayerSearch>
export type TournamentsResponse = Env<{ sync: TournamentCurrent | null; async: TournamentCurrent | null }>
export type TournamentHistoryResponse = Env<{ rows: TournamentHistoryRow[]; detail: TournamentHistoryDetail['tournaments'] }>
export type BracketResponse = Env<BracketDetail>
export type CardsResponse = Env<CardStat[]>
export type CardLeadersResponse = Env<{ sweepers: CardLeader[]; winners: CardLeader[] }>
export type CardPickersResponse = Env<CardTopPickers>
```

- [ ] **Step 4: Write `src/web/api/hooks.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import type {
  FfaHistory,
  MatchesSummary,
  OvtHistory,
  PlayerAchievements,
  PlayerMatch,
  PlayerTournaments,
  RatingHistory,
  TeamHistory,
  TeamStats,
  VsTopCards,
} from '../../shared/api-types'
import { hubGet } from './client'
import type {
  AnyBoard,
  BoardMode,
  BracketResponse,
  CardLeadersResponse,
  CardPickersResponse,
  CardsResponse,
  Env,
  HomeEnvelope,
  HubProfile,
  MeResponse,
  MetaEnvelope,
  Results1v1Response,
  ResultsResponse,
  SearchResponse,
  StatusResponse,
  TournamentHistoryResponse,
  TournamentsResponse,
} from './types'

export const POLL = { LIVE: 15_000, BOARD: 60_000, PLAYER: 60_000, RESULTS: 30_000, REF: 600_000 } as const

const live = { refetchInterval: POLL.LIVE, refetchIntervalInBackground: false, staleTime: 5_000 }
const board = { refetchInterval: POLL.BOARD, refetchIntervalInBackground: false, staleTime: 20_000 }
const player = { refetchInterval: POLL.PLAYER, refetchIntervalInBackground: false, staleTime: 30_000 }
const results = { refetchInterval: POLL.RESULTS, refetchIntervalInBackground: false, staleTime: 10_000 }
const ref = { staleTime: POLL.REF, refetchInterval: false as const }

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== false) u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

export function useHome() {
  return useQuery({ queryKey: ['home'], queryFn: () => hubGet<HomeEnvelope>('/home'), ...live })
}

export function useLeaderboard(mode: BoardMode | string, inactive: boolean) {
  return useQuery({
    queryKey: ['leaderboard', mode, inactive],
    queryFn: () => hubGet<Env<AnyBoard>>(`/leaderboard/${mode}${inactive ? '?inactive=1' : ''}`),
    ...board,
  })
}

export function usePlayer(steamId: string | undefined, me: string | null | undefined) {
  const viewer = me && me !== steamId ? me : undefined
  return useQuery({
    queryKey: ['player', steamId, viewer ?? null],
    queryFn: () => hubGet<Env<HubProfile>>(`/players/${steamId}${qs({ me: viewer })}`),
    enabled: !!steamId,
    ...player,
  })
}

export type PlayerSub =
  | 'matches'
  | 'matches-summary'
  | 'rating-history'
  | 'team-history'
  | 'ffa-history'
  | 'ovt-history'
  | 'team-stats'
  | 'achievements'
  | 'tournaments'

export interface SubTypes {
  matches: PlayerMatch[]
  'matches-summary': MatchesSummary
  'rating-history': RatingHistory
  'team-history': TeamHistory
  'ffa-history': FfaHistory
  'ovt-history': OvtHistory
  'team-stats': TeamStats
  achievements: PlayerAchievements
  tournaments: PlayerTournaments
}

export function usePlayerSub<S extends PlayerSub>(steamId: string | undefined, sub: S, params: Record<string, string | number | undefined> = {}, enabled = true) {
  return useQuery({
    queryKey: ['player', steamId, sub, params],
    queryFn: () => hubGet<Env<SubTypes[S]>>(`/players/${steamId}/${sub}${qs(params)}`),
    enabled: !!steamId && enabled,
    ...player,
  })
}

export function useVs(steamId: string | undefined, opp: string | null | undefined) {
  return useQuery({
    queryKey: ['vs', steamId, opp],
    queryFn: () => hubGet<Env<VsTopCards>>(`/players/${steamId}/vs/${opp}`),
    enabled: !!steamId && !!opp && steamId !== opp,
    ...player,
  })
}

export function useResults(limit = 60) {
  return useQuery({ queryKey: ['results', limit], queryFn: () => hubGet<ResultsResponse>(`/results${qs({ limit })}`), ...results })
}

export function useResults1v1(limit = 50) {
  return useQuery({ queryKey: ['results-1v1', limit], queryFn: () => hubGet<Results1v1Response>(`/results/1v1${qs({ limit })}`), ...results })
}

export function useTournaments() {
  return useQuery({ queryKey: ['tournaments'], queryFn: () => hubGet<TournamentsResponse>('/tournaments'), ...board })
}

export function useTournamentHistory() {
  return useQuery({ queryKey: ['tournament-history'], queryFn: () => hubGet<TournamentHistoryResponse>('/tournaments/history'), ...board })
}

export function useBracket(id: string | undefined) {
  return useQuery({ queryKey: ['bracket', id], queryFn: () => hubGet<BracketResponse>(`/tournaments/${id}/bracket`), enabled: !!id, ...board })
}

export function useCards(filter: string, sort: string, order: 'asc' | 'desc') {
  return useQuery({ queryKey: ['cards', filter, sort, order], queryFn: () => hubGet<CardsResponse>(`/cards${qs({ filter, sort, order })}`), ...ref })
}

export function useCardLeaders() {
  return useQuery({ queryKey: ['card-leaders'], queryFn: () => hubGet<CardLeadersResponse>('/cards/leaders'), ...ref })
}

export function useCardPickers(name: string | null) {
  return useQuery({
    queryKey: ['card-pickers', name],
    queryFn: () => hubGet<CardPickersResponse>(`/cards/${encodeURIComponent(name!)}/pickers`),
    enabled: !!name,
    ...ref,
  })
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => hubGet<MetaEnvelope>('/meta'), ...ref })
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => hubGet<MeResponse>('/me'), staleTime: 60_000, retry: false, refetchInterval: false })
}

export function useSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ['search', term],
    queryFn: () => hubGet<SearchResponse>(`/players/search${qs({ q: term })}`),
    enabled: term.length >= 1,
    staleTime: 30_000,
    refetchInterval: false,
  })
}

export function useStatus() {
  return useQuery({ queryKey: ['status'], queryFn: () => hubGet<StatusResponse>('/_status'), staleTime: 60_000, refetchInterval: false })
}
```

- [ ] **Step 5: Write the primitive components**

`src/web/components/TitleTag.tsx`:

```tsx
export function TitleTag({ title, color }: { title?: string | null; color?: string | null }) {
  if (!title) return null
  return (
    <span className="chip" style={{ color: color || 'var(--fg-muted)', background: 'color-mix(in srgb, currentColor 14%, transparent)' }}>
      {title}
    </span>
  )
}
```

`src/web/components/PlayerLink.tsx`:

```tsx
import { Link } from 'react-router'
import { TitleTag } from './TitleTag'

interface Props {
  steamId: string
  name: string
  title?: string | null
  titleColor?: string | null
  online?: boolean
  me?: boolean
  bold?: boolean
}

export function PlayerLink({ steamId, name, title, titleColor, online, me, bold }: Props) {
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      {online !== undefined ? <span className={`dot${online ? ' on' : ''}`} aria-label={online ? 'online' : 'offline'} /> : null}
      <Link to={`/players/${steamId}`} style={{ fontWeight: bold || me ? 800 : 600 }}>
        {name}
        {me ? <span className="faint"> (you)</span> : null}
      </Link>
      <TitleTag title={title} color={titleColor} />
    </span>
  )
}
```

`src/web/components/RankChip.tsx`:

```tsx
import { FALLBACK_TIERS, tierFor, type RankTier } from '../../shared/rank'

interface Props {
  name?: string | null
  color?: string | null
  rating?: number | null
  tiers?: RankTier[]
}

export function RankChip({ name, color, rating, tiers }: Props) {
  let label = name ?? ''
  let c = color ?? ''
  if (!label && rating !== null && rating !== undefined) {
    const t = tierFor(rating, tiers?.length ? tiers : FALLBACK_TIERS)
    label = t.name
    c = t.color
  }
  if (!label) return null
  return (
    <span className="chip" style={{ border: `1px solid ${c || 'var(--line)'}`, color: c || 'var(--fg-muted)' }}>
      {label}
    </span>
  )
}
```

`src/web/components/StatTile.tsx`:

```tsx
export function StatTile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className={`value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  )
}
```

`src/web/components/Tabs.tsx`:

```tsx
export interface Tab {
  id: string
  label: string
}

export function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

`src/web/components/FormStrip.tsx`:

```tsx
import type { FormEntry } from '../../shared/api-types'

export function FormStrip({ form, max = 20 }: { form: FormEntry[] | undefined; max?: number }) {
  const items = (form ?? []).slice(0, max)
  if (!items.length) return <span className="faint">no recent games</span>
  return (
    <span aria-label="recent form">
      {items.map((f, i) => (
        <span key={i} className={`form-w ${f.result === 'W' ? 'w' : 'l'}`} title={`${f.result} ${f.score} vs ${f.opponent}${f.ranked ? ' (ranked)' : ''}`}>
          {f.result}
        </span>
      ))}
    </span>
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS. `npm run typecheck` — clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add player primitives and data hooks"
```

---

### Task 4: Identity ("me"): search, pin, Discord sign-in

**Files:**
- Create: `src/web/lib/identity.ts`, `src/web/components/SearchBox.tsx`, `src/web/components/IdentityMenu.tsx`
- Modify: `src/web/App.tsx` (pass `<IdentityMenu />` into `Layout`)
- Test: `tests/web/identity.test.tsx`

**Interfaces:**
- Produces: `useIdentity(): { me: { steam_id: string; display_name: string } | null; source: 'discord' | 'pinned' | null; discord: MeResponse['data']['discord']; authEnabled: boolean; pin(p): void; unpin(): void }`, `readPinned()`, `writePinned(p | null)`, `<SearchBox onSelect={(r) => …} placeholder? autoFocus? />`, `<IdentityMenu />`.

- [ ] **Step 1: Write the failing test**

`tests/web/identity.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { IdentityMenu } from '../../src/web/components/IdentityMenu'
import { readPinned, writePinned } from '../../src/web/lib/identity'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: true }

describe('identity', () => {
  beforeEach(() => localStorage.clear())

  it('offers search and pins a player from the results', async () => {
    mockHub({ '/me': SIGNED_OUT, '/players/search?q=nic': env({ results: [{ steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101 }] }) })
    renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    await userEvent.type(screen.getByRole('searchbox'), 'nic')
    await userEvent.click(await screen.findByRole('option', { name: /NotNic/ }))
    await waitFor(() => expect(screen.getByRole('link', { name: /NotNic/ })).toHaveAttribute('href', '/players/76561199311926326'))
    expect(readPinned()).toEqual({ steam_id: '76561199311926326', display_name: 'NotNic' })
  })

  it('prefers the Discord-linked player over the pin and shows the sign-out control', async () => {
    writePinned({ steam_id: '1', display_name: 'Pinned' })
    mockHub({ '/me': { data: { discord: { id: '1299', username: 'ntnic', avatar: null, global_name: 'Nic' }, player: { steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101, peak_rating: 1337, level: 40 } }, auth_enabled: true } })
    renderApp(<IdentityMenu />)
    await waitFor(() => expect(screen.getByRole('link', { name: /NotNic/ })).toBeInTheDocument())
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('hides the Discord button when auth is disabled and shows the link hint when unlinked', async () => {
    mockHub({ '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    expect(screen.queryByRole('link', { name: /sign in with discord/i })).not.toBeInTheDocument()

    mockHub({ '/me': { data: { discord: { id: '1', username: 'x', avatar: null, global_name: null }, player: null }, auth_enabled: true } })
    renderApp(<IdentityMenu />)
    await waitFor(() => expect(screen.getByText(/link your discord in-game/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/identity.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/lib/identity.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMe } from '../api/hooks'
import { hubPost } from '../api/client'

export interface Pinned {
  steam_id: string
  display_name: string
}

const KEY = 'scrhub.me'
const EVENT = 'scrhub:me'

export function readPinned(): Pinned | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Pinned
    return p && typeof p.steam_id === 'string' && typeof p.display_name === 'string' ? p : null
  } catch {
    return null
  }
}

export function writePinned(p: Pinned | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: the pin lives for this render only
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useIdentity() {
  const me = useMe()
  const qc = useQueryClient()
  const [pinned, setPinned] = useState<Pinned | null>(readPinned)

  useEffect(() => {
    const sync = () => setPinned(readPinned())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const linked = me.data?.data.player
  const discord = me.data?.data.discord ?? null
  const resolved: Pinned | null = linked ? { steam_id: linked.steam_id, display_name: linked.display_name } : pinned

  const pin = useCallback((p: Pinned) => writePinned(p), [])
  const unpin = useCallback(() => writePinned(null), [])
  const signOut = useCallback(async () => {
    await hubPost('/../auth/logout').catch(() => undefined)
    await qc.invalidateQueries({ queryKey: ['me'] })
  }, [qc])

  return {
    me: resolved,
    source: linked ? ('discord' as const) : pinned ? ('pinned' as const) : null,
    discord,
    authEnabled: me.data?.auth_enabled ?? false,
    loading: me.isPending,
    pin,
    unpin,
    signOut,
  }
}
```

Note: `hubPost('/../auth/logout')` resolves to `${BASE}/api/../auth/logout` = `${BASE}/auth/logout` after URL normalisation by the browser. Use `authUrl` instead for clarity:

```ts
import { authUrl } from '../api/client'
// in signOut:
await fetch(authUrl('/logout'), { method: 'POST', credentials: 'same-origin' }).catch(() => undefined)
```

Use the `authUrl` version; delete the `hubPost` import.

- [ ] **Step 4: Write `src/web/components/SearchBox.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useSearch } from '../api/hooks'
import type { PlayerSearchResult } from '../../shared/api-types'

export function SearchBox({ onSelect, placeholder = 'Search players…', autoFocus }: { onSelect: (r: PlayerSearchResult) => void; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), 200)
    return () => clearTimeout(id)
  }, [text])
  const q = useSearch(debounced)
  const results = q.data?.data.results ?? []
  return (
    <div>
      <input className="input" type="search" role="searchbox" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label="Search players" />
      {debounced && (
        <ul role="listbox" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
          {q.isPending ? <li className="faint">Searching…</li> : null}
          {results.map((r) => (
            <li key={r.steam_id}>
              <button role="option" aria-selected={false} className="btn" style={{ width: '100%', justifyContent: 'space-between', marginTop: 4 }} onClick={() => onSelect(r)}>
                <span>{r.display_name}</span>
                <span className="muted mono">{Math.round(r.rating)}</span>
              </button>
            </li>
          ))}
          {q.isSuccess && results.length === 0 ? <li className="faint">No players match.</li> : null}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/web/components/IdentityMenu.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { authUrl } from '../api/client'
import { useIdentity } from '../lib/identity'
import { SearchBox } from './SearchBox'

export function IdentityMenu() {
  const id = useIdentity()
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      {id.me ? (
        <span className="row" style={{ gap: 6 }}>
          <Link to={`/players/${id.me.steam_id}`} className="btn" title={id.source === 'discord' ? 'Linked through Discord' : 'Pinned in this browser'}>
            {id.source === 'discord' ? '◈ ' : '📌 '}
            {id.me.display_name}
          </Link>
          <button className="btn" onClick={() => setOpen((o) => !o)} aria-label="Identity options">
            ▾
          </button>
        </span>
      ) : (
        <button className="btn" onClick={() => setOpen((o) => !o)}>
          Find me
        </button>
      )}
      {open ? (
        <div className="card" style={{ position: 'absolute', right: 0, top: 44, width: 'min(320px, 90vw)', boxShadow: 'var(--shadow)', zIndex: 20 }}>
          {id.source === 'discord' ? (
            <>
              <p className="muted">Signed in as {id.discord?.global_name ?? id.discord?.username}.</p>
              <button className="btn" onClick={() => void id.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              {id.discord && !id.me ? <p className="muted">Signed in as {id.discord.username}, but no player is linked. Link your Discord in-game (F5 → Settings) or pin yourself below.</p> : null}
              <SearchBox
                autoFocus
                placeholder="Pin yourself: type your name"
                onSelect={(r) => {
                  id.pin({ steam_id: r.steam_id, display_name: r.display_name })
                  setOpen(false)
                }}
              />
              {id.me ? (
                <button className="btn" style={{ marginTop: 8 }} onClick={() => { id.unpin(); setOpen(false) }}>
                  Unpin {id.me.display_name}
                </button>
              ) : null}
              {id.authEnabled && !id.discord ? (
                <a className="btn btn-accent" style={{ marginTop: 8 }} href={authUrl('/discord/login')}>
                  Sign in with Discord
                </a>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 6: Pass the menu into the layout in `src/web/App.tsx`**

Replace `<Route element={<Layout />}>` with `<Route element={<Layout identity={<IdentityMenu />} />}>` and add `import { IdentityMenu } from './components/IdentityMenu'`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS (identity: 3 tests). `npm run typecheck` — clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add identity: search-and-pin and Discord sign-in menu"
```

---

### Task 5: Home page

**Files:**
- Create: `src/web/pages/Home.tsx`, `src/web/components/LiveSeriesCard.tsx`
- Modify: `src/web/App.tsx` (index route)
- Test: `tests/web/home.test.tsx`, `tests/web/helpers/fixtures.ts`

**Interfaces:**
- Produces: `<Home />` rendering maintenance/alert banners, online + recently online, queue counts, live 1v1 series, live 2v2 series, FFA lobbies, spectatable games and latest results (spec 7.2 item 1).
- Produces (test helper): `homeEnvelope(overrides?)` built from `fixtures/presence__online.json` and `fixtures/series__recent-multimode.json`.

- [ ] **Step 1: Write the fixture helper**

`tests/web/helpers/fixtures.ts`:

```ts
import presence from '../../../fixtures/presence__online.json'
import multimode from '../../../fixtures/series__recent-multimode.json'
import leaderboard from '../../../fixtures/leaderboard.json'
import teamBoard from '../../../fixtures/team__leaderboard.json'
import ffaBoard from '../../../fixtures/ffa__leaderboard.json'
import ovtBoard from '../../../fixtures/ovt__leaderboard.json'
import profileRaw from '../../../fixtures/players__ID.json'
import matchesRaw from '../../../fixtures/players__ID__matches.json'
import achievements from '../../../fixtures/achievements__ID.json'
import tournamentCurrent from '../../../fixtures/tournaments__current.json'
import tournamentHistory from '../../../fixtures/tournaments__history.json'
import tournamentHistoryDetail from '../../../fixtures/tournaments__history-detail.json'
import cards from '../../../fixtures/cards.json'
import { maskProfile, slimMatch } from '../../../src/shared/privacy'
import type { HomeData } from '../../../src/shared/hub-types'
import { env } from './mockHub'

export const LIVE_1V1 = {
  series_id: 's1', p1_steam_id: '76561199311926326', p1_name: 'NotNic', p1_rating: 1101, p1_rd: 66, p1_wins: 1, p1_odds: 2.1, p1_bettable: true,
  p2_steam_id: '76561198040410653', p2_name: 'Sid', p2_rating: 2564, p2_rd: 127, p2_wins: 0, p2_odds: 1.05, p2_bettable: false,
  live_p1_points: 1, live_p2_points: 0, bets_locked: true, lock_reason: 'game_in_progress', is_private: false, is_tournament: true,
  tournament_kind: 'sync' as const, tournament_label: 'Sync Tournament - Round 1', phase: 'live' as const, started_at: new Date().toISOString(),
}

export function homeData(overrides: Partial<HomeData> = {}): HomeData {
  return {
    presence: presence as HomeData['presence'],
    queue: { ranked_searching: 1, team_searching: 0, online: (presence as HomeData['presence']).online_count },
    live: { series_1v1: [LIVE_1V1], series_2v2: [], ffa_lobbies: [], spectate: [] },
    results: (multimode as { entries: HomeData['results'] }).entries,
    maintenance: false,
    alerts: [],
    ...overrides,
  }
}

export const homeEnvelope = (overrides: Partial<HomeData> = {}) => env(homeData(overrides), { errors: [] })
export const boards = { '1v1': leaderboard, '2v2': teamBoard, ffa: ffaBoard, '1v2': ovtBoard }
export const profile = maskProfile(profileRaw as Record<string, unknown>)
export const matches = (matchesRaw as Record<string, unknown>[]).map(slimMatch)
export { achievements, tournamentCurrent, tournamentHistory, tournamentHistoryDetail, cards }
```

- [ ] **Step 2: Write the failing test**

`tests/web/home.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub } from './helpers/mockHub'
import { homeEnvelope } from './helpers/fixtures'
import { Home } from '../../src/web/pages/Home'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('Home', () => {
  it('shows who is online, queue counts, the live series and latest results', async () => {
    mockHub({ '/home': homeEnvelope(), '/me': SIGNED_OUT })
    renderApp(<Home />)
    await waitFor(() => expect(screen.getByText(/online now/i)).toBeInTheDocument())
    expect(screen.getByText(/1 searching/i)).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /NotNic/ }).length).toBeGreaterThan(0)
    expect(screen.getByText('Sync Tournament - Round 1')).toBeInTheDocument()
    expect(screen.getByText(/latest results/i)).toBeInTheDocument()
  })

  it('shows maintenance and alert banners', async () => {
    mockHub({ '/home': homeEnvelope({ maintenance: true, alerts: [{ message: 'Update tonight', expires_at: null }] }), '/me': SIGNED_OUT })
    renderApp(<Home />)
    await waitFor(() => expect(screen.getByText(/maintenance/i)).toBeInTheDocument())
    expect(screen.getByText('Update tonight')).toBeInTheDocument()
  })

  it('renders empty live sections without crashing when nothing is on', async () => {
    mockHub({ '/home': homeEnvelope({ live: { series_1v1: [], series_2v2: [], ffa_lobbies: [], spectate: [] }, results: [] }), '/me': SIGNED_OUT })
    renderApp(<Home />)
    await waitFor(() => expect(screen.getByText(/no live games/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/home.test.tsx` — expected FAIL.

- [ ] **Step 4: Write `src/web/components/LiveSeriesCard.tsx`**

```tsx
import type { ActiveSeries, ActiveTeamSeries, FfaLobby, SpectateGame } from '../../shared/api-types'
import { relTime } from '../lib/format'
import { PlayerLink } from './PlayerLink'

export function LiveSeries1v1({ s }: { s: ActiveSeries }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip live-pill">{s.phase === 'live' ? 'LIVE' : 'STARTING'}</span>
        {s.is_tournament && s.tournament_label ? <span className="chip">{s.tournament_label}</span> : null}
        {s.is_private ? <span className="chip">private room</span> : null}
        <span className="spacer" />
        <span className="faint">{relTime(s.started_at)}</span>
      </div>
      <div className="row" style={{ marginTop: 8, fontSize: 17 }}>
        <PlayerLink steamId={s.p1_steam_id} name={s.p1_name} bold />
        <span className="muted mono">{s.p1_rating}</span>
        <span className="mono" style={{ fontWeight: 900, fontSize: 20, margin: '0 8px' }}>
          {s.p1_wins} – {s.p2_wins}
        </span>
        <span className="muted mono">{s.p2_rating}</span>
        <PlayerLink steamId={s.p2_steam_id} name={s.p2_name} bold />
      </div>
      <div className="faint" style={{ marginTop: 4 }}>
        Best of 3 · current game {s.live_p1_points}–{s.live_p2_points}
        {s.bets_locked ? ' · bets locked' : ` · odds ${s.p1_odds}× / ${s.p2_odds}×`}
      </div>
    </div>
  )
}

export function LiveSeries2v2({ s }: { s: ActiveTeamSeries }) {
  const team = (a: [string, string], b: [string, string], color: string) => (
    <span className="row" style={{ gap: 6 }}>
      <span className="dot on" style={{ background: color || 'var(--fg-faint)', boxShadow: 'none' }} />
      <PlayerLink steamId={a[0]} name={a[1]} />
      <span className="faint">&amp;</span>
      <PlayerLink steamId={b[0]} name={b[1]} />
    </span>
  )
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip live-pill">LIVE 2v2</span>
        <span className="spacer" />
        <span className="faint">{relTime(s.started_at)}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {team([s.t1a_steam, s.t1a_name], [s.t1b_steam, s.t1b_name], s.t1_color_hex)}
        <div className="mono" style={{ fontWeight: 900, fontSize: 20, margin: '4px 0' }}>
          {s.t1_wins} – {s.t2_wins}
        </div>
        {team([s.t2a_steam, s.t2a_name], [s.t2b_steam, s.t2b_name], s.t2_color_hex)}
      </div>
      <div className="faint" style={{ marginTop: 4 }}>
        Team ratings {s.t1_rating} vs {s.t2_rating} · current game {s.live_t1_points ?? 0}–{s.live_t2_points ?? 0}
      </div>
    </div>
  )
}

export function FfaLobbyCard({ l }: { l: FfaLobby }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip live-pill">FFA LOBBY</span>
        <strong>{l.host_name}'s lobby</strong>
        <span className="muted">
          {l.player_count}/{l.max_players}
        </span>
        {l.has_password ? <span className="chip">locked</span> : null}
        <span className="spacer" />
        <span className="faint">open {relTime(new Date(Date.now() - l.age_seconds * 1000).toISOString())}</span>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        {l.members.map((m, i) => (
          <span key={i} className="chip" style={{ background: 'var(--bg-elev)' }}>
            {m.name} <span className="muted">{m.rating}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function SpectateCard({ g }: { g: SpectateGame }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip">{g.mode.toUpperCase()}</span>
        <strong>{g.names}</strong>
        <span className="spacer" />
        <span className="faint">
          {g.spectatable ? `${g.spectator_count}/${g.spectator_cap} watching` : 'not spectatable'}
        </span>
      </div>
      <div className="faint">Watch from the game: F5 → Leaderboard → WATCH</div>
    </div>
  )
}
```

Note: `ActiveTeamSeries` has no `live_t1_points` in the captured type; the `?? 0` keeps this tolerant. Add `live_t1_points?: number; live_t2_points?: number` to `ActiveTeamSeries` in `src/shared/api-types.ts` (the upstream SQL selects them; the appended dict omits them today).

- [ ] **Step 5: Write `src/web/pages/Home.tsx`**

```tsx
import { Link } from 'react-router'
import { useHome } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { PlayerLink } from '../components/PlayerLink'
import { FfaLobbyCard, LiveSeries1v1, LiveSeries2v2, SpectateCard } from '../components/LiveSeriesCard'
import { useIdentity } from '../lib/identity'
import { relTime, signed } from '../lib/format'
import type { MultimodeEntry } from '../../shared/api-types'

const MODE_LABEL: Record<string, string> = { '1v1': '1v1', '2v2': '2v2', ffa: 'FFA', ovt: '1v2' }

export function ResultRow({ e }: { e: MultimodeEntry }) {
  return (
    <tr>
      <td>
        <span className="chip" style={{ background: 'var(--bg-elev)' }}>{MODE_LABEL[e.mode] ?? e.mode}</span>
      </td>
      <td>
        <strong>{e.left_label}</strong>
        {e.left_rating_change !== null && e.left_rating_change !== undefined ? (
          <span className={`mono ${e.left_rating_change >= 0 ? 'good' : 'bad'}`} style={{ marginLeft: 6 }}>
            {signed(e.left_rating_change, 1)}
          </span>
        ) : null}
      </td>
      <td className="mono" style={{ fontWeight: 800 }}>
        {e.score}
      </td>
      <td>
        {e.right_label}
        {e.right_rating_change !== null && e.right_rating_change !== undefined ? (
          <span className={`mono ${e.right_rating_change >= 0 ? 'good' : 'bad'}`} style={{ marginLeft: 6 }}>
            {signed(e.right_rating_change, 1)}
          </span>
        ) : null}
      </td>
      <td className="faint">{relTime(e.ended_at)}</td>
    </tr>
  )
}

export function Home() {
  const q = useHome()
  const id = useIdentity()
  return (
    <>
      <h1>Right now</h1>
      <QueryState q={q} label="live data">
        {(d, meta) => {
          const liveCount = d.live.series_1v1.length + d.live.series_2v2.length + d.live.ffa_lobbies.length
          return (
            <>
              {d.maintenance ? <div className="banner warn">Sid's server is in maintenance. Data may pause for a few minutes.</div> : null}
              {d.alerts.map((a, i) => (
                <div key={i} className="banner warn">
                  {a.message}
                </div>
              ))}
              {meta.errors.length ? <div className="banner bad">Some sections could not be loaded: {meta.errors.join(', ')}.</div> : null}

              <div className="tiles" style={{ marginBottom: 14 }}>
                <div className="tile">
                  <div className="label">Online now</div>
                  <div className="value">{d.presence.online_count}</div>
                  <div className="sub">mod players</div>
                </div>
                <div className="tile">
                  <div className="label">Ranked queue</div>
                  <div className="value">{d.queue.ranked_searching}</div>
                  <div className="sub">{d.queue.ranked_searching === 1 ? '1 searching' : `${d.queue.ranked_searching} searching`}</div>
                </div>
                <div className="tile">
                  <div className="label">2v2 queue</div>
                  <div className="value">{d.queue.team_searching}</div>
                  <div className="sub">searching</div>
                </div>
                <div className="tile">
                  <div className="label">Live games</div>
                  <div className="value">{liveCount}</div>
                  <div className="sub">1v1, 2v2 and FFA</div>
                </div>
              </div>

              <div className="grid-2">
                <section className="card">
                  <div className="card-head">
                    <h2>Live games</h2>
                  </div>
                  {liveCount === 0 && d.live.spectate.length === 0 ? <div className="empty">No live games right now.</div> : null}
                  {d.live.series_1v1.map((s) => (
                    <LiveSeries1v1 key={s.series_id} s={s} />
                  ))}
                  {d.live.series_2v2.map((s) => (
                    <LiveSeries2v2 key={s.series_id} s={s} />
                  ))}
                  {d.live.ffa_lobbies.map((l) => (
                    <FfaLobbyCard key={l.lobby_id} l={l} />
                  ))}
                  {d.live.spectate.map((g) => (
                    <SpectateCard key={g.game_id} g={g} />
                  ))}
                </section>

                <section className="card">
                  <div className="card-head">
                    <h2>Who's on</h2>
                    <span className="muted">{d.presence.online_count} online</span>
                  </div>
                  {d.presence.online.length === 0 ? <div className="empty">Nobody online at the moment.</div> : null}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {d.presence.online.map((p) => (
                      <li key={p.steam_id} className="row" style={{ minHeight: 36 }}>
                        <PlayerLink steamId={p.steam_id} name={p.display_name} title={p.title} titleColor={p.title_color} online me={id.me?.steam_id === p.steam_id} />
                        <span className="spacer" />
                        <span className="mono muted">{p.rating}</span>
                      </li>
                    ))}
                  </ul>
                  {d.presence.recent.length ? (
                    <>
                      <h3 style={{ marginTop: 12 }}>Recently online</h3>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {d.presence.recent.map((p) => (
                          <li key={p.steam_id} className="row" style={{ minHeight: 32 }}>
                            <PlayerLink steamId={p.steam_id} name={p.display_name} title={p.title} titleColor={p.title_color} me={id.me?.steam_id === p.steam_id} />
                            <span className="spacer" />
                            <span className="faint">{p.minutes_ago}m ago</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </section>
              </div>

              <section className="card">
                <div className="card-head">
                  <h2>Latest results</h2>
                  <Link to="/results" className="muted">
                    all results →
                  </Link>
                </div>
                {d.results.length === 0 ? <div className="empty">No recent results.</div> : null}
                {d.results.length ? (
                  <div className="table-wrap">
                    <table className="t">
                      <tbody>
                        {d.results.slice(0, 12).map((e) => (
                          <ResultRow key={`${e.mode}-${e.id}`} e={e} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            </>
          )
        }}
      </QueryState>
    </>
  )
}
```

- [ ] **Step 6: Route it**

In `src/web/App.tsx`: `import { Home } from './pages/Home'` and change the index route to `<Route index element={<Home />} />`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS (home: 3 tests). `npm run typecheck` — clean.

- [ ] **Step 8: Look at it**

```bash
npm run build && npm run preview &
```

Open `http://localhost:8080/` — the Home page renders from fixtures (live sections will be empty unless the fixtures were captured during a match). Check a phone-width viewport in the browser devtools: no horizontal scroll. Stop the server afterwards.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add Home page with live games, presence, queues and latest results"
```

---

### Task 6: Leaderboards page

**Files:**
- Create: `src/web/pages/Leaderboards.tsx`
- Modify: `src/web/App.tsx`
- Test: `tests/web/leaderboards.test.tsx`

**Interfaces:**
- Produces: `<Leaderboards />` reading `:mode` from the route (`1v1`, `2v2`, `ffa`, `1v2`, `1v2-solo`, `1v2-duo`), with search, "show inactive", pagination (50 per page), online dots, rank-tier chips, and the "me" row highlighted.

- [ ] **Step 1: Write the failing test**

`tests/web/leaderboards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { boards } from './helpers/fixtures'
import { writePinned } from '../../src/web/lib/identity'
import { Leaderboards } from '../../src/web/pages/Leaderboards'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('Leaderboards', () => {
  it('renders the 1v1 board with tier chips, online dots and pagination', async () => {
    const lb = boards['1v1'] as { entries: Array<Record<string, unknown>>; total_players: number }
    mockHub({ '/leaderboard/1v1': env(lb), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/1v1', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.length).toBe(Math.min(50, lb.entries.length))
    expect(screen.getByText(String(lb.entries[0].rank_name))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${lb.total_players} players`))).toBeInTheDocument()
  })

  it('filters by name and highlights me', async () => {
    const lb = boards['1v1'] as { entries: Array<{ steam_id: string; display_name: string }> }
    writePinned({ steam_id: lb.entries[0].steam_id, display_name: lb.entries[0].display_name })
    mockHub({ '/leaderboard/1v1': env(lb), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/1v1', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(document.querySelector('tr.me')).not.toBeNull()
    await userEvent.type(screen.getByRole('searchbox'), lb.entries[0].display_name.slice(0, 3))
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeLessThan(52))
    localStorage.clear()
  })

  it('switches columns for the 2v2, FFA and 1v2 boards', async () => {
    mockHub({ '/leaderboard/2v2': env(boards['2v2']), '/leaderboard/ffa': env(boards.ffa), '/leaderboard/1v2': env(boards['1v2']), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/2v2', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getByText('Series')).toBeInTheDocument())
    renderApp(<Leaderboards />, { route: '/leaderboards/ffa', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getByText('Avg place')).toBeInTheDocument())
    renderApp(<Leaderboards />, { route: '/leaderboards/1v2', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getByText('Solo W-L')).toBeInTheDocument())
  })

  it('requests inactive players when toggled', async () => {
    const { calls } = mockHub({ '/leaderboard/1v1': env(boards['1v1']), '/leaderboard/1v1?inactive=1': env(boards['1v1']), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/1v1', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText(/show inactive/i))
    await waitFor(() => expect(calls).toContain('/leaderboard/1v1?inactive=1'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/leaderboards.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/pages/Leaderboards.tsx`**

```tsx
import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useParams } from 'react-router'
import type { FfaLeaderboardEntry, LeaderboardEntry, OvtLeaderboardEntry, TeamLeaderboardEntry } from '../../shared/api-types'
import { useLeaderboard, useMeta } from '../api/hooks'
import type { AnyBoard } from '../api/types'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { RankChip } from '../components/RankChip'
import { useIdentity } from '../lib/identity'
import { goldText, pct } from '../lib/format'

const PAGE = 50

const MODES: Array<{ id: string; label: string }> = [
  { id: '1v1', label: '1v1' },
  { id: '2v2', label: '2v2' },
  { id: 'ffa', label: 'FFA' },
  { id: '1v2', label: '1v2' },
  { id: '1v2-solo', label: '1v2 solo' },
  { id: '1v2-duo', label: '1v2 duo' },
]

type Row = LeaderboardEntry | TeamLeaderboardEntry | FfaLeaderboardEntry | OvtLeaderboardEntry

interface Col {
  key: string
  label: string
  num?: boolean
  cell: (r: Row) => ReactNode
}

function colsFor(mode: string, tiers: Parameters<typeof RankChip>[0]['tiers']): Col[] {
  const rating: Col = { key: 'rating', label: 'Rating', num: true, cell: (r) => <strong className="mono">{'rating' in r ? Math.round(r.rating) : '–'}</strong> }
  const level: Col = { key: 'level', label: 'Lvl', num: true, cell: (r) => r.level }
  if (mode === '2v2') {
    return [
      rating,
      { key: 'series', label: 'Series', num: true, cell: (r) => (r as TeamLeaderboardEntry).completed_series },
      { key: 'wl', label: 'W-L', num: true, cell: (r) => `${(r as TeamLeaderboardEntry).series_wins}-${(r as TeamLeaderboardEntry).series_losses}` },
      { key: 'wr', label: 'Win %', num: true, cell: (r) => pct((r as TeamLeaderboardEntry).win_rate) },
      { key: 'peak', label: 'Peak', num: true, cell: (r) => Math.round((r as TeamLeaderboardEntry).peak_rating) },
      level,
    ]
  }
  if (mode === 'ffa') {
    const f = (r: Row) => r as FfaLeaderboardEntry
    return [
      rating,
      { key: 'games', label: 'Games', num: true, cell: (r) => f(r).games_played },
      { key: 'wins', label: 'Wins', num: true, cell: (r) => f(r).wins },
      { key: 'top3', label: 'Top 3', num: true, cell: (r) => f(r).top3 },
      { key: 'avg', label: 'Avg place', num: true, cell: (r) => f(r).avg_placement?.toFixed(2) ?? '–' },
      { key: 'wr', label: 'Win %', num: true, cell: (r) => pct(f(r).win_rate) },
      level,
    ]
  }
  if (mode.startsWith('1v2')) {
    const o = (r: Row) => r as OvtLeaderboardEntry
    return [
      { key: 'games', label: 'Games', num: true, cell: (r) => o(r).games_played },
      { key: 'wl', label: 'W-L', num: true, cell: (r) => `${o(r).wins}-${o(r).losses}` },
      { key: 'wr', label: 'Win %', num: true, cell: (r) => (o(r).win_rate === undefined ? '–' : `${Math.round(o(r).win_rate)}%`) },
      { key: 'solo', label: 'Solo W-L', num: true, cell: (r) => `${o(r).solo_wins}-${o(r).solo_losses}` },
      { key: 'duo', label: 'Duo W-L', num: true, cell: (r) => `${o(r).duo_wins}-${o(r).duo_losses}` },
      level,
    ]
  }
  const l = (r: Row) => r as LeaderboardEntry
  return [
    rating,
    { key: 'tier', label: 'Tier', cell: (r) => <RankChip name={l(r).rank_name} color={l(r).rank_color} rating={l(r).rating} tiers={tiers} /> },
    { key: 'wl', label: 'W-L', num: true, cell: (r) => `${l(r).wins}-${l(r).losses}` },
    { key: 'wr', label: 'Win %', num: true, cell: (r) => pct(l(r).win_rate) },
    { key: 'games', label: 'Series', num: true, cell: (r) => l(r).total_matches },
    level,
    { key: 'gold', label: 'Gold', num: true, cell: (r) => goldText(l(r).gold, false) },
  ]
}

export function Leaderboards() {
  const { mode = '1v1' } = useParams()
  const [inactive, setInactive] = useState(false)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const q = useLeaderboard(mode, inactive)
  const meta = useMeta()
  const id = useIdentity()
  const cols = useMemo(() => colsFor(mode, meta.data?.data.rank_tiers), [mode, meta.data])

  return (
    <>
      <h1>Leaderboards</h1>
      <div className="tabs" role="tablist">
        {MODES.map((m) => (
          <NavLink key={m.id} to={`/leaderboards/${m.id}`} role="tab" aria-selected={m.id === mode} className="btn" style={{ border: 0, borderRadius: 0 }} onClick={() => { setPage(0); setFilter('') }}>
            {m.label}
          </NavLink>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" type="search" role="searchbox" aria-label="Filter by name" placeholder="Filter by name" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }} style={{ maxWidth: 320 }} />
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={inactive} onChange={(e) => { setInactive(e.target.checked); setPage(0) }} /> show inactive (90+ days)
        </label>
      </div>
      <div className="card">
        <QueryState q={q} label="leaderboard">
          {(board: AnyBoard) => {
            const all = (board.entries as Row[]) ?? []
            const needle = filter.trim().toLowerCase()
            const rows = needle ? all.filter((r) => r.display_name.toLowerCase().includes(needle)) : all
            const pages = Math.max(1, Math.ceil(rows.length / PAGE))
            const slice = rows.slice(page * PAGE, page * PAGE + PAGE)
            return (
              <>
                <div className="row muted" style={{ marginBottom: 6 }}>
                  <span>{board.total_players} players ranked</span>
                  <span className="spacer" />
                  {pages > 1 ? (
                    <span className="row">
                      <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
                      <span>
                        {page + 1} / {pages}
                      </span>
                      <button className="btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
                    </span>
                  ) : null}
                </div>
                <div className="table-wrap">
                  <table className="t">
                    <thead>
                      <tr>
                        <th className="num">#</th>
                        <th>Player</th>
                        {cols.map((c) => (
                          <th key={c.key} className={c.num ? 'num' : undefined}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slice.map((r) => (
                        <tr key={r.steam_id} className={id.me?.steam_id === r.steam_id ? 'me' : undefined}>
                          <td className="num mono">{r.rank}</td>
                          <td>
                            <PlayerLink steamId={r.steam_id} name={r.display_name} title={r.title} titleColor={r.title_color} online={r.is_online} me={id.me?.steam_id === r.steam_id} />
                            {r.inactive ? <span className="chip faint">inactive</span> : null}
                          </td>
                          {cols.map((c) => (
                            <td key={c.key} className={c.num ? 'num' : undefined}>
                              {c.cell(r)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          }}
        </QueryState>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Route it**

In `src/web/App.tsx`: import `Leaderboards` and set `<Route path="leaderboards/:mode" element={<Leaderboards />} />`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS (leaderboards: 4 tests). `npm run typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Leaderboards page for all modes"
```

---

### Task 7: Player page header, overview and rating graph

**Files:**
- Create: `src/web/pages/Player.tsx`, `src/web/pages/player/Overview.tsx`, `src/web/components/RatingGraph.tsx`
- Modify: `src/web/App.tsx`
- Test: `tests/web/player.test.tsx`

**Interfaces:**
- Produces: `<Player />` (route `players/:steamId`, `?tab=` for sub-tabs), `<Overview p={HubProfile} />`, `<RatingGraph history ffa? />`. Tab ids: `overview`, `matches`, `2v2`, `ffa`, `1v2`, `achievements`, `tournaments`, `h2h` (the latter only when "me" is set and differs). Tab components for everything except `overview` arrive in Task 8; until then `Player.tsx` renders `<EmptyState title="Coming soon" />` for them.

- [ ] **Step 1: Write the failing test**

`tests/web/player.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { profile } from './helpers/fixtures'
import { writePinned } from '../../src/web/lib/identity'
import { Player } from '../../src/web/pages/Player'

vi.mock('../../src/web/components/RatingGraph', () => ({ RatingGraph: () => <div data-testid="graph" /> }))

const ME = '76561199311926326'
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
const p = profile as { display_name: string; rating: number; peak_rating: number; ranked_series_wins: number; ranked_series_losses: number; level: number }

describe('Player', () => {
  it('renders the header, tiles, form and graph, never a Discord id or gold when hidden', async () => {
    mockHub({ [`/players/${ME}`]: env({ ...profile, gold_hidden: true, gold_earned: undefined, gold_spent: undefined }), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: new RegExp(p.display_name) })).toBeInTheDocument())
    expect(screen.getByText(String(Math.round(p.rating)))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`peak ${Math.round(p.peak_rating)}`))).toBeInTheDocument()
    expect(screen.getByText(`${p.ranked_series_wins}-${p.ranked_series_losses}`)).toBeInTheDocument()
    expect(screen.getByTestId('graph')).toBeInTheDocument()
    expect(screen.getByText('hidden')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('1299197810780143656')
    expect(screen.queryByLabelText(/online/)).not.toBeInTheDocument()
  })

  it('offers "pin as me" and requests the profile with me= once pinned', async () => {
    const calls = mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}?me=76561198040410653`]: env(profile), '/me': SIGNED_OUT }).calls
    writePinned({ steam_id: '76561198040410653', display_name: 'Sid' })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    await waitFor(() => expect(calls).toContain(`/players/${ME}?me=76561198040410653`))
    await userEvent.click(screen.getByRole('button', { name: /this is me/i }))
    await waitFor(() => expect(screen.getByText(/\(you\)/)).toBeInTheDocument())
    localStorage.clear()
  })

  it('shows a not-found state for an unknown player and rejects a malformed id', async () => {
    mockHub({ [`/players/${ME}`]: () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
    renderApp(<Player />, { route: '/players/abc', path: '/players/:steamId' })
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/player.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/components/RatingGraph.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { FfaRatingPoint, RatingPoint } from '../../shared/api-types'

function series(points: Array<{ date: string; rating: number }> | undefined): [number[], number[]] {
  const xs: number[] = []
  const ys: number[] = []
  for (const p of points ?? []) {
    const t = Date.parse(p.date) / 1000
    if (Number.isFinite(t) && Number.isFinite(p.rating)) {
      xs.push(t)
      ys.push(p.rating)
    }
  }
  return [xs, ys]
}

/** Rating over time. 1v1 in the accent color, FFA (optional) in the info color. */
export function RatingGraph({ history, ffa }: { history: RatingPoint[] | undefined; ffa?: FfaRatingPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [x1, y1] = series(history)
  const [x2, y2] = series(ffa)
  const showFfa = x2.length >= 2

  useEffect(() => {
    const el = ref.current
    if (!el || x1.length < 2) return
    const css = getComputedStyle(document.documentElement)
    const color = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback
    const data = showFfa ? uPlot.join([[x1, y1], [x2, y2]]) : ([x1, y1] as uPlot.AlignedData)
    const opts: uPlot.Options = {
      width: Math.max(280, el.clientWidth),
      height: 220,
      legend: { show: showFfa },
      cursor: { drag: { x: false, y: false } },
      axes: [
        { stroke: color('--fg-muted', '#999'), grid: { stroke: 'rgba(128,128,128,0.15)' } },
        { stroke: color('--fg-muted', '#999'), grid: { stroke: 'rgba(128,128,128,0.15)' }, size: 52 },
      ],
      series: [
        {},
        { label: '1v1', stroke: color('--accent', '#ffcc33'), width: 2, spanGaps: true },
        ...(showFfa ? [{ label: 'FFA', stroke: color('--info', '#77a3fc'), width: 2, spanGaps: true }] : []),
      ],
    }
    const chart = new uPlot(opts, data, el)
    const ro = new ResizeObserver(() => chart.setSize({ width: Math.max(280, el.clientWidth), height: 220 }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      chart.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, ffa])

  if (x1.length < 2) return <div className="empty">Not enough rated games for a graph yet.</div>
  return <div ref={ref} style={{ width: '100%' }} aria-label="Rating over time" />
}
```

- [ ] **Step 4: Write `src/web/pages/player/Overview.tsx`**

```tsx
import type { HubProfile } from '../../api/types'
import { FormStrip } from '../../components/FormStrip'
import { RatingGraph } from '../../components/RatingGraph'
import { StatTile } from '../../components/StatTile'
import { goldText, num, pct, signed } from '../../lib/format'

function ratio(a: number | undefined, b: number | undefined): string {
  if (!a || !b) return '–'
  return pct(a / b)
}

export function Overview({ p }: { p: HubProfile }) {
  const gold = p.gold_hidden ? undefined : (p.gold_earned ?? 0) - (p.gold_spent ?? 0)
  const streak = p.current_ranked_series_streak ?? 0
  return (
    <>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <StatTile label="Rating" value={Math.round(p.rating)} sub={`peak ${Math.round(p.peak_rating)}`} />
        <StatTile label="Standing" value={p.standing ? `#${p.standing}` : '–'} sub={p.standing_population ? `of ${p.standing_population}` : undefined} />
        <StatTile label="Ranked series" value={`${p.ranked_series_wins}-${p.ranked_series_losses}`} sub={ratio(p.ranked_series_wins, p.ranked_series_wins + p.ranked_series_losses) + ' win rate'} />
        <StatTile label="Streak" value={signed(streak)} sub="series" tone={streak > 0 ? 'good' : streak < 0 ? 'bad' : undefined} />
        <StatTile label="Level" value={p.level} sub={`${num(p.xp_into_level)} / ${num(p.xp_for_next_level)} xp`} />
        <StatTile label="Casual" value={`${p.casual_wins ?? 0}-${p.casual_losses ?? 0}`} sub="games" />
        <StatTile label="Accuracy" value={ratio(p.bullets_hit, p.bullets_fired)} sub={`block ${ratio(p.blocks_successful, p.blocks_activated)}`} />
        <StatTile label="Gold" value={goldText(gold, p.gold_hidden)} sub={p.gold_hidden ? 'player hides gold' : 'balance'} />
        {p.team_completed_series ? <StatTile label="2v2 rating" value={Math.round(p.team_rating)} sub={`${p.team_completed_series} series`} /> : null}
        {p.ffa_games ? <StatTile label="FFA" value={p.ffa_rating ? Math.round(p.ffa_rating) : `${p.ffa_wins} wins`} sub={`avg place ${p.ffa_avg_placement?.toFixed(2) ?? '–'} · ${p.ffa_games} games`} /> : null}
        {p.ovt_solo_wins + p.ovt_solo_losses + p.ovt_duo_wins + p.ovt_duo_losses > 0 ? <StatTile label="1v2" value={`${p.ovt_solo_wins + p.ovt_duo_wins}-${p.ovt_solo_losses + p.ovt_duo_losses}`} sub={`solo ${p.ovt_solo_wins}-${p.ovt_solo_losses} · duo ${p.ovt_duo_wins}-${p.ovt_duo_losses}`} /> : null}
        <StatTile label="Sweeps" value={`${p.sweeps_given ?? 0} / ${p.sweeps_taken ?? 0}`} sub="given / taken" />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent form</h2>
          <span className="muted">newest first</span>
        </div>
        <FormStrip form={p.recent_form} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Rating over time</h2>
        </div>
        <RatingGraph history={p.recent_rating_history} ffa={p.ffa_rating_history} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Top cards</h2>
          <CardList cards={p.top_cards} />
        </div>
        <div className="card">
          <h2>Worst cards</h2>
          <CardList cards={p.worst_cards} />
        </div>
      </div>
    </>
  )
}

function CardList({ cards }: { cards: HubProfile['top_cards'] | undefined }) {
  if (!cards?.length) return <div className="empty">No card data yet.</div>
  return (
    <table className="t">
      <thead>
        <tr>
          <th>Card</th>
          <th className="num">Picks</th>
          <th className="num">Win %</th>
        </tr>
      </thead>
      <tbody>
        {cards.slice(0, 10).map((c) => (
          <tr key={c.card_name}>
            <td>{c.card_name}</td>
            <td className="num">{c.times_picked}</td>
            <td className={`num ${c.win_rate >= 0.55 ? 'good' : c.win_rate <= 0.45 ? 'bad' : ''}`}>{pct(c.win_rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 5: Write `src/web/pages/Player.tsx`**

```tsx
import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useMeta, usePlayer } from '../api/hooks'
import type { HubProfile } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { QueryState } from '../components/QueryState'
import { RankChip } from '../components/RankChip'
import { Tabs } from '../components/Tabs'
import { TitleTag } from '../components/TitleTag'
import { useIdentity } from '../lib/identity'
import { relTime } from '../lib/format'
import { NotFound } from './NotFound'
import { Overview } from './player/Overview'

export const PLAYER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: '1v1 matches' },
  { id: '2v2', label: '2v2' },
  { id: 'ffa', label: 'FFA' },
  { id: '1v2', label: '1v2' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'tournaments', label: 'Tournaments' },
]

// Task 8 replaces these with the real tab components.
const TabBody: Record<string, (props: { p: HubProfile; me: string | null }) => ReactNode> = {
  overview: ({ p }) => <Overview p={p} />,
}

export function Player() {
  const { steamId } = useParams()
  const [params, setParams] = useSearchParams()
  const id = useIdentity()
  const meta = useMeta()
  const valid = !!steamId && /^\d{17}$/.test(steamId)
  const q = usePlayer(valid ? steamId : undefined, id.me?.steam_id ?? null)
  if (!valid) return <NotFound />

  const isMe = id.me?.steam_id === steamId
  const tabs = isMe || !id.me ? PLAYER_TABS : [...PLAYER_TABS, { id: 'h2h', label: `vs ${id.me.display_name}` }]
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'overview'

  return (
    <QueryState q={q} label="player">
      {(p) => (
        <>
          <header className="card">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ marginBottom: 4 }}>
                  {p.display_name}
                  {isMe ? <span className="faint" style={{ fontSize: 14 }}> (you)</span> : null}
                </h1>
                <div className="row">
                  <RankChip name={p.rank_name} color={p.rank_color} rating={p.rating} tiers={meta.data?.data.rank_tiers} />
                  <TitleTag title={p.active_title} color={p.active_title_color} />
                  {p.show_discord && p.discord_display_name ? <span className="chip" style={{ background: 'var(--bg-elev)' }}>Discord: {p.discord_display_name}</span> : null}
                </div>
                <div className="faint" style={{ marginTop: 6 }}>
                  {p.last_match ? `last match ${relTime(p.last_match)}` : 'no matches yet'}
                  {p.mod_version ? ` · mod v${p.mod_version}` : ''}
                </div>
              </div>
              <span className="spacer" />
              {!isMe ? (
                <button className="btn" onClick={() => id.pin({ steam_id: p.steam_id, display_name: p.display_name })}>
                  This is me
                </button>
              ) : null}
            </div>
          </header>
          <Tabs tabs={tabs} value={tab} onChange={(t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })} />
          {(TabBody[tab] ?? (() => <EmptyState title="Coming soon" />))({ p, me: id.me?.steam_id ?? null })}
        </>
      )}
    </QueryState>
  )
}
```

- [ ] **Step 6: Route it**

In `src/web/App.tsx`: import `Player` and set `<Route path="players/:steamId" element={<Player />} />`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS (player: 3 tests). `npm run typecheck` — clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add Player page with overview tiles, form and rating graph"
```

---

### Task 8: Player tabs: matches, 2v2, FFA, 1v2, achievements, tournaments, head-to-head

**Files:**
- Create: `src/web/pages/player/Matches.tsx`, `src/web/pages/player/TeamHistory.tsx`, `src/web/pages/player/FfaHistory.tsx`, `src/web/pages/player/OvtHistory.tsx`, `src/web/pages/player/Achievements.tsx`, `src/web/pages/player/TournamentsTab.tsx`, `src/web/pages/player/HeadToHead.tsx`, `src/web/lib/series.ts`
- Modify: `src/web/pages/Player.tsx` (fill `TabBody`)
- Test: `tests/web/series.test.ts`, `tests/web/playerTabs.test.tsx`

**Interfaces:**
- Produces: `groupSeries(matches: PlayerMatch[]): SeriesGroup[]` where `SeriesGroup = { key: string; series_id: string | null; ranked: boolean; opponent_steam_id: string; opponent_name: string; opponent_title: string; opponent_title_color: string; score: string | null; rating_change: number | null; ended_at: string; games: PlayerMatch[] }`. Consecutive rows sharing a `series_id` form one group (newest first, as upstream returns them); casual rows are single-game groups.
- Produces the seven tab components, each taking `{ steamId }` except `HeadToHead` which takes `{ p: HubProfile; me: string }`.

- [ ] **Step 1: Write the failing tests**

`tests/web/series.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupSeries } from '../../src/web/lib/series'
import type { PlayerMatch } from '../../src/shared/api-types'

const m = (over: Partial<PlayerMatch>): PlayerMatch =>
  ({ match_id: 'x', opponent_steam_id: '1', opponent_name: 'A', opponent_title: '', opponent_title_color: '', player_rounds_won: 5, opponent_rounds_won: 2, player_points: 2, opponent_points: 0, won: true, is_ranked: true, ended_at: '2026-09-21T07:17:22Z', cards_picked: [], opponent_cards_picked: [], series_id: 's1', series_score: '2-0', series_rating_change: 8.9, xp_gained: 0, gold_gained: 0, series_gold_gained: 0, player_fps_avg: null, opponent_fps_avg: null, player_bullets_fired: 0, player_bullets_hit: 0, player_blocks_activated: 0, player_blocks_successful: 0, opp_bullets_fired: 0, opp_bullets_hit: 0, opp_blocks_activated: 0, opp_blocks_successful: 0, player_ping_avg: null, opponent_ping_avg: null, duration_seconds: null, player_damage_dealt: null, opp_damage_dealt: null, rules: null, sitting_head: false, ...over }) as PlayerMatch

describe('groupSeries', () => {
  it('groups consecutive games of one series and keeps casual games separate', () => {
    const groups = groupSeries([
      m({ match_id: 'g2', series_id: 's1' }),
      m({ match_id: 'g1', series_id: 's1' }),
      m({ match_id: 'c1', series_id: null, is_ranked: false, series_score: null, series_rating_change: null }),
      m({ match_id: 'g0', series_id: 's0', opponent_name: 'B' }),
    ])
    expect(groups.map((g) => g.games.length)).toEqual([2, 1, 1])
    expect(groups[0].score).toBe('2-0')
    expect(groups[0].rating_change).toBe(8.9)
    expect(groups[1].ranked).toBe(false)
    expect(groups[2].opponent_name).toBe('B')
  })

  it('handles an empty list', () => {
    expect(groupSeries([])).toEqual([])
  })
})
```

`tests/web/playerTabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { profile, matches, achievements } from './helpers/fixtures'
import { Player } from '../../src/web/pages/Player'

vi.mock('../../src/web/components/RatingGraph', () => ({ RatingGraph: () => <div data-testid="graph" /> }))

const ME = '76561199311926326'
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('Player tabs', () => {
  it('renders matches grouped by series with card chips', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}/matches?limit=100`]: env(matches), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}?tab=matches`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getAllByText(/game \d/i).length).toBeGreaterThan(0))
    const first = matches[0] as { cards_picked: Array<{ card_name: string }> }
    if (first.cards_picked.length) expect(screen.getAllByText(first.cards_picked[0].card_name).length).toBeGreaterThan(0)
  })

  it('renders achievements with unlocked first', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}/achievements`]: env(achievements), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}?tab=achievements`, path: '/players/:steamId' })
    const list = achievements as { achievements: Array<{ name: string; unlocked: boolean }> }
    await waitFor(() => expect(screen.getByText(list.achievements[0].name)).toBeInTheDocument())
    const unlockedCount = list.achievements.filter((a) => a.unlocked).length
    expect(screen.getByText(new RegExp(`${unlockedCount} of ${list.achievements.length}`))).toBeInTheDocument()
  })

  it('renders 2v2, FFA and 1v2 histories from empty and filled responses', async () => {
    mockHub({
      [`/players/${ME}`]: env(profile),
      [`/players/${ME}/team-history`]: env({ series: [{ series_id: 't', won: false, score: '0-2', mate: 'MangoJuice', opponents: ['Stan', 'embargo'], rating_change: -72.9, completed_at: '2026-09-11T01:34:56Z', rules: null }] }),
      [`/players/${ME}/ffa-history`]: env({ games: [] }),
      [`/players/${ME}/ovt-history`]: env({ games: [{ match_id: 'o', role: 'duo', won: true, score: '5-4', solo: 'Stan', duo: ['Spirit', 'NotNic'], ended_at: '2026-08-20T21:16:30Z', gold_gained: 25, series_gold_gained: 0, rules: null }] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Player />, { route: `/players/${ME}?tab=2v2`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByText('MangoJuice')).toBeInTheDocument())
    renderApp(<Player />, { route: `/players/${ME}?tab=ffa`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByText(/no ffa games/i)).toBeInTheDocument())
    renderApp(<Player />, { route: `/players/${ME}?tab=1v2`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByText(/Spirit/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project web tests/web/series.test.ts tests/web/playerTabs.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/lib/series.ts`**

```ts
import type { PlayerMatch } from '../../shared/api-types'

export interface SeriesGroup {
  key: string
  series_id: string | null
  ranked: boolean
  opponent_steam_id: string
  opponent_name: string
  opponent_title: string
  opponent_title_color: string
  score: string | null
  rating_change: number | null
  ended_at: string
  games: PlayerMatch[]
}

/** Upstream returns newest first. Consecutive rows with the same series_id are one series. */
export function groupSeries(matches: PlayerMatch[]): SeriesGroup[] {
  const out: SeriesGroup[] = []
  for (const m of matches) {
    const last = out[out.length - 1]
    if (m.series_id && last && last.series_id === m.series_id) {
      last.games.push(m)
      continue
    }
    out.push({
      key: m.series_id ?? m.match_id,
      series_id: m.series_id ?? null,
      ranked: !!m.is_ranked,
      opponent_steam_id: m.opponent_steam_id,
      opponent_name: m.opponent_name,
      opponent_title: m.opponent_title,
      opponent_title_color: m.opponent_title_color,
      score: m.series_score ?? null,
      rating_change: m.series_rating_change ?? null,
      ended_at: m.ended_at,
      games: [m],
    })
  }
  return out
}
```

- [ ] **Step 4: Write `src/web/pages/player/Matches.tsx`**

```tsx
import { useState } from 'react'
import type { CardPick, PlayerMatch } from '../../../shared/api-types'
import { usePlayerSub } from '../../api/hooks'
import { PlayerLink } from '../../components/PlayerLink'
import { QueryState } from '../../components/QueryState'
import { fmtDate, pct, signed } from '../../lib/format'
import { groupSeries } from '../../lib/series'

function Cards({ cards }: { cards: CardPick[] | undefined }) {
  if (!cards?.length) return <span className="faint">no picks</span>
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      {cards.map((c, i) => (
        <span key={i} className="chip" style={{ background: 'var(--bg-elev)', fontWeight: 500, opacity: c.rolled ? 0.5 : 1 }} title={`${c.card_rarity} · pick ${c.pick_order}, round ${c.round_number}`}>
          {c.card_name}
        </span>
      ))}
    </span>
  )
}

function Game({ g, n }: { g: PlayerMatch; n: number }) {
  const acc = g.player_bullets_fired ? pct(g.player_bullets_hit / g.player_bullets_fired) : '–'
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
      <div className="row">
        <span className="faint">Game {n}</span>
        <strong className={g.won ? 'good' : 'bad'}>{g.won ? 'W' : 'L'}</strong>
        <span className="mono">
          {g.player_rounds_won}–{g.opponent_rounds_won}
        </span>
        <span className="faint">
          rounds · pts {g.player_points}–{g.opponent_points} · hit {acc}
        </span>
        <span className="spacer" />
        <span className="faint">
          +{g.xp_gained} xp · +{g.gold_gained}g
        </span>
      </div>
      <div style={{ marginTop: 4 }}>
        <span className="faint">you: </span>
        <Cards cards={g.cards_picked} />
      </div>
      <div style={{ marginTop: 4 }}>
        <span className="faint">them: </span>
        <Cards cards={g.opponent_cards_picked} />
      </div>
    </div>
  )
}

export function Matches({ steamId }: { steamId: string }) {
  const [filter, setFilter] = useState<'all' | 'ranked' | 'casual'>('all')
  const q = usePlayerSub(steamId, 'matches', { limit: 100 })
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        {(['all', 'ranked', 'casual'] as const).map((f) => (
          <button key={f} className={`btn${filter === f ? ' btn-accent' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <QueryState q={q} label="matches" empty={(d) => d.length === 0} emptyHint="Matches appear once the mod reports them.">
        {(rows) => {
          const groups = groupSeries(rows).filter((g) => filter === 'all' || (filter === 'ranked') === g.ranked)
          if (!groups.length) return <div className="empty">No {filter} matches in the last 100 games.</div>
          return groups.map((g) => (
            <details key={g.key} className="card" style={{ marginBottom: 8 }}>
              <summary className="row" style={{ cursor: 'pointer', minHeight: 40 }}>
                <span className={`chip ${g.ranked ? 'live-pill' : ''}`} style={g.ranked ? { background: 'var(--info)' } : { background: 'var(--bg-elev)' }}>
                  {g.ranked ? 'RANKED' : 'casual'}
                </span>
                <PlayerLink steamId={g.opponent_steam_id} name={g.opponent_name} title={g.opponent_title} titleColor={g.opponent_title_color} />
                <span className="spacer" />
                {g.ranked && g.score ? <strong className="mono">{g.score}</strong> : <strong className="mono">{g.games[0].won ? 'W' : 'L'}</strong>}
                {g.rating_change !== null ? <span className={`mono ${g.rating_change >= 0 ? 'good' : 'bad'}`}>{signed(g.rating_change, 1)}</span> : null}
                <span className="faint">{fmtDate(g.ended_at)}</span>
              </summary>
              {[...g.games].reverse().map((game, i) => (
                <Game key={game.match_id} g={game} n={i + 1} />
              ))}
            </details>
          ))
        }}
      </QueryState>
    </div>
  )
}
```

- [ ] **Step 5: Write the other history tabs**

`src/web/pages/player/TeamHistory.tsx`:

```tsx
import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate, signed } from '../../lib/format'

export function TeamHistoryTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'team-history')
  const stats = usePlayerSub(steamId, 'team-stats')
  return (
    <div className="card">
      {stats.data ? (
        <div className="muted" style={{ marginBottom: 8 }}>
          2v2 rating {Math.round(stats.data.data.rating)} · peak {Math.round(stats.data.data.peak_rating)} · series {stats.data.data.series_wins}-{stats.data.data.series_losses} · streak {signed(stats.data.data.current_streak)}
        </div>
      ) : null}
      <QueryState q={q} label="2v2 series" empty={(d) => !d.series?.length} emptyHint="No 2v2 series yet.">
        {(d) => (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Result</th>
                  <th>With</th>
                  <th>Against</th>
                  <th className="num">Rating</th>
                </tr>
              </thead>
              <tbody>
                {d.series.map((s) => (
                  <tr key={s.series_id}>
                    <td className="faint">{fmtDate(s.completed_at)}</td>
                    <td>
                      <strong className={s.won ? 'good' : 'bad'}>{s.won ? 'W' : 'L'}</strong> <span className="mono">{s.score}</span>
                    </td>
                    <td>{s.mate}</td>
                    <td>{(s.opponents ?? []).join(' & ')}</td>
                    <td className={`num mono ${s.rating_change >= 0 ? 'good' : 'bad'}`}>{signed(s.rating_change, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </div>
  )
}
```

`src/web/pages/player/FfaHistory.tsx`:

```tsx
import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate, signed } from '../../lib/format'

export function FfaHistoryTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'ffa-history')
  return (
    <div className="card">
      <QueryState q={q} label="FFA games" empty={(d) => !d.games?.length} emptyHint="No FFA games yet.">
        {(d) => (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Place</th>
                  <th className="num">Kills</th>
                  <th className="num">Rounds</th>
                  <th className="num">Points</th>
                  <th className="num">Rating</th>
                  <th>Lobby</th>
                </tr>
              </thead>
              <tbody>
                {d.games.map((g) => (
                  <tr key={g.match_id}>
                    <td className="faint">{fmtDate(g.ended_at)}</td>
                    <td>
                      <strong className={g.placement === 1 ? 'good' : ''}>#{g.placement}</strong>
                      <span className="faint"> of {g.player_count}</span>
                    </td>
                    <td className="num">{g.kills}</td>
                    <td className="num">{g.rounds_won}</td>
                    <td className="num">{g.points_total}</td>
                    <td className={`num mono ${g.rating_change >= 0 ? 'good' : 'bad'}`}>{signed(g.rating_change, 1)}</td>
                    <td className="faint">{(g.participants ?? []).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </div>
  )
}
```

`src/web/pages/player/OvtHistory.tsx`:

```tsx
import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate } from '../../lib/format'

export function OvtHistoryTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'ovt-history')
  return (
    <div className="card">
      <QueryState q={q} label="1v2 games" empty={(d) => !d.games?.length} emptyHint="No 1v2 games yet.">
        {(d) => (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Role</th>
                  <th>Result</th>
                  <th>Solo</th>
                  <th>Duo</th>
                  <th className="num">Gold</th>
                </tr>
              </thead>
              <tbody>
                {d.games.map((g) => (
                  <tr key={g.match_id}>
                    <td className="faint">{fmtDate(g.ended_at)}</td>
                    <td>{g.role}</td>
                    <td>
                      <strong className={g.won ? 'good' : 'bad'}>{g.won ? 'W' : 'L'}</strong> <span className="mono">{g.score}</span>
                    </td>
                    <td>{g.solo}</td>
                    <td>{(g.duo ?? []).join(' & ')}</td>
                    <td className="num">+{g.gold_gained}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </div>
  )
}
```

`src/web/pages/player/Achievements.tsx`:

```tsx
import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate } from '../../lib/format'

export function AchievementsTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'achievements')
  return (
    <div className="card">
      <QueryState q={q} label="achievements" empty={(d) => !d.achievements?.length}>
        {(d) => {
          const sorted = [...d.achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? ''))
          const n = sorted.filter((a) => a.unlocked).length
          return (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>
                {n} of {sorted.length} unlocked
              </div>
              <div className="tiles">
                {sorted.map((a) => (
                  <div key={a.achievement_key} className="tile" style={{ opacity: a.unlocked ? 1 : 0.55 }}>
                    <div className="value" style={{ fontSize: 15 }}>
                      {a.unlocked ? '✓ ' : ''}
                      {a.name}
                    </div>
                    <div className="sub">
                      {a.gold}g · {a.global_pct}% of players
                    </div>
                    {a.unlocked_at ? <div className="faint">{fmtDate(a.unlocked_at)}</div> : null}
                  </div>
                ))}
              </div>
            </>
          )
        }}
      </QueryState>
    </div>
  )
}
```

`src/web/pages/player/TournamentsTab.tsx`:

```tsx
import { Link } from 'react-router'
import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { StatTile } from '../../components/StatTile'

export function TournamentsTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'tournaments')
  return (
    <div className="card">
      <QueryState q={q} label="tournament record">
        {(d) => (
          <>
            <div className="tiles">
              <StatTile label="Wins" value={d.winner_count} />
              <StatTile label="Runner-up" value={d.runner_up_count} />
              <StatTile label="Third" value={d.third_place_count} />
              <StatTile label="Played" value={d.participant_count} />
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Upcoming and past brackets are on the <Link to="/tournaments">Tournaments</Link> page.
            </p>
          </>
        )}
      </QueryState>
    </div>
  )
}
```

`src/web/pages/player/HeadToHead.tsx`:

```tsx
import { useVs } from '../../api/hooks'
import type { HubProfile } from '../../api/types'
import { QueryState } from '../../components/QueryState'
import { StatTile } from '../../components/StatTile'
import { pct } from '../../lib/format'

/** Head-to-head between the viewed player `p` and the viewer `me` (h2h_* fields are p's perspective). */
export function HeadToHead({ p, me }: { p: HubProfile; me: string }) {
  const vs = useVs(p.steam_id, me)
  return (
    <>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <StatTile label="Ranked series" value={`${p.h2h_series_wins ?? 0}-${p.h2h_series_losses ?? 0}`} sub={`${p.display_name} vs you`} />
        <StatTile label="Ranked games" value={`${p.h2h_ranked_wins ?? 0}-${p.h2h_ranked_losses ?? 0}`} />
        <StatTile label="Casual games" value={`${p.h2h_casual_wins ?? 0}-${p.h2h_casual_losses ?? 0}`} />
      </div>
      <div className="card">
        <h2>Most picked against each other</h2>
        <QueryState q={vs} label="head-to-head cards" empty={(d) => !d.player_cards?.length && !d.opponent_cards?.length}>
          {(d) => (
            <div className="grid-2">
              <div>
                <h3>{p.display_name}</h3>
                <CardRows rows={d.player_cards} />
              </div>
              <div>
                <h3>You</h3>
                <CardRows rows={d.opponent_cards} />
              </div>
            </div>
          )}
        </QueryState>
      </div>
    </>
  )
}

function CardRows({ rows }: { rows: Array<{ card_name: string; picks: number; wins: number }> }) {
  return (
    <table className="t">
      <tbody>
        {rows.map((r) => (
          <tr key={r.card_name}>
            <td>{r.card_name}</td>
            <td className="num">{r.picks}×</td>
            <td className="num">{pct(r.picks ? r.wins / r.picks : 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 6: Fill `TabBody` in `src/web/pages/Player.tsx`**

Replace the `TabBody` constant with:

```tsx
import { Matches } from './player/Matches'
import { TeamHistoryTab } from './player/TeamHistory'
import { FfaHistoryTab } from './player/FfaHistory'
import { OvtHistoryTab } from './player/OvtHistory'
import { AchievementsTab } from './player/Achievements'
import { TournamentsTab } from './player/TournamentsTab'
import { HeadToHead } from './player/HeadToHead'

const TabBody: Record<string, (props: { p: HubProfile; me: string | null }) => ReactNode> = {
  overview: ({ p }) => <Overview p={p} />,
  matches: ({ p }) => <Matches steamId={p.steam_id} />,
  '2v2': ({ p }) => <TeamHistoryTab steamId={p.steam_id} />,
  ffa: ({ p }) => <FfaHistoryTab steamId={p.steam_id} />,
  '1v2': ({ p }) => <OvtHistoryTab steamId={p.steam_id} />,
  achievements: ({ p }) => <AchievementsTab steamId={p.steam_id} />,
  tournaments: ({ p }) => <TournamentsTab steamId={p.steam_id} />,
  h2h: ({ p, me }) => (me ? <HeadToHead p={p} me={me} /> : <EmptyState title="Pin yourself to compare." />),
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS (series: 2, playerTabs: 3). `npm run typecheck` — clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add player history, achievements, tournament and head-to-head tabs"
```

---

### Task 9: Results page

**Files:**
- Create: `src/web/pages/Results.tsx`
- Modify: `src/web/App.tsx`
- Test: `tests/web/results.test.tsx`

**Interfaces:**
- Produces: `<Results />` with a mode filter (All, 1v1, 2v2, FFA, 1v2). "All" and non-1v1 modes render the multimode feed through `ResultRow` (from `pages/Home.tsx`); "1v1" renders the richer recent-series table (players with ratings, series score, rating changes, streaks, bet count).

- [ ] **Step 1: Write the failing test**

`tests/web/results.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import multimode from '../../fixtures/series__recent-multimode.json'
import { Results } from '../../src/web/pages/Results'

const SERIES_1V1 = { series: [{ series_id: 's', game_codes: [], p1_name: 'Zezima', p1_steam_id: '76561199195193559', p1_rating: 1480.5, p1_rating_change: 19.3, p1_streak: 1, p2_name: 'Necro', p2_steam_id: '76561198228681248', p2_rating: 1297.2, p2_rating_change: -110.2, p2_streak: -3, p1_series_wins: 2, p2_series_wins: 1, winner_name: 'Zezima', winner_steam_id: '76561199195193559', completed_at: '2026-09-22T09:57:53Z', rules: null, bets: [{ bettor_name: 'Spirit', amount: 2000 }], tournament: false, tournament_label: '' }] }

describe('Results', () => {
  it('renders the multimode feed and filters by mode', async () => {
    const entries = (multimode as { entries: Array<{ mode: string }> }).entries
    mockHub({ '/results?limit=100': env(multimode), '/results/1v1?limit=50': env(SERIES_1V1), '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(<Results />)
    await waitFor(() => expect(screen.getAllByRole('row').length).toBe(entries.length))
    await userEvent.click(screen.getByRole('tab', { name: 'FFA' }))
    const ffa = entries.filter((e) => e.mode === 'ffa').length
    await waitFor(() => expect(screen.getAllByRole('row').length).toBe(ffa))
    await userEvent.click(screen.getByRole('tab', { name: '1v1' }))
    await waitFor(() => expect(screen.getByText('Zezima')).toBeInTheDocument())
    expect(screen.getByText('+19.3')).toBeInTheDocument()
    expect(screen.getByText(/1 bet/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/results.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/pages/Results.tsx`**

```tsx
import { useState } from 'react'
import { useResults, useResults1v1 } from '../api/hooks'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { Tabs } from '../components/Tabs'
import { relTime, signed } from '../lib/format'
import { ResultRow } from './Home'

const TABS = [
  { id: 'all', label: 'All' },
  { id: '1v1', label: '1v1' },
  { id: '2v2', label: '2v2' },
  { id: 'ffa', label: 'FFA' },
  { id: 'ovt', label: '1v2' },
]

export function Results() {
  const [tab, setTab] = useState('all')
  const feed = useResults(100)
  const series = useResults1v1(50)
  return (
    <>
      <h1>Results</h1>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="card">
        {tab === '1v1' ? (
          <QueryState q={series} label="ranked series" empty={(d) => !d.series?.length}>
            {(d) => (
              <div className="table-wrap">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Winner</th>
                      <th className="num">Score</th>
                      <th>Loser</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.series.map((s) => {
                      const p1Won = s.winner_steam_id === s.p1_steam_id
                      const w = p1Won ? { id: s.p1_steam_id, name: s.p1_name, r: s.p1_rating, d: s.p1_rating_change, st: s.p1_streak, wins: s.p1_series_wins } : { id: s.p2_steam_id, name: s.p2_name, r: s.p2_rating, d: s.p2_rating_change, st: s.p2_streak, wins: s.p2_series_wins }
                      const l = p1Won ? { id: s.p2_steam_id, name: s.p2_name, r: s.p2_rating, d: s.p2_rating_change, st: s.p2_streak, wins: s.p2_series_wins } : { id: s.p1_steam_id, name: s.p1_name, r: s.p1_rating, d: s.p1_rating_change, st: s.p1_streak, wins: s.p1_series_wins }
                      return (
                        <tr key={s.series_id}>
                          <td>
                            <PlayerLink steamId={w.id} name={w.name} bold /> <span className="muted mono">{Math.round(w.r)}</span>{' '}
                            <span className="mono good">{signed(w.d, 1)}</span>
                            {s.tournament ? <span className="chip" style={{ marginLeft: 6 }}>{s.tournament_label || 'tournament'}</span> : null}
                          </td>
                          <td className="num mono" style={{ fontWeight: 800 }}>
                            {w.wins}–{l.wins}
                          </td>
                          <td>
                            <PlayerLink steamId={l.id} name={l.name} /> <span className="muted mono">{Math.round(l.r)}</span>{' '}
                            <span className="mono bad">{signed(l.d, 1)}</span>
                          </td>
                          <td className="faint">
                            {relTime(s.completed_at)}
                            {s.bets?.length ? ` · ${s.bets.length} bet${s.bets.length === 1 ? '' : 's'}` : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
        ) : (
          <QueryState q={feed} label="results" empty={(d) => !d.entries?.length}>
            {(d) => {
              const rows = tab === 'all' ? d.entries : d.entries.filter((e) => e.mode === tab)
              if (!rows.length) return <div className="empty">No recent {TABS.find((t) => t.id === tab)?.label} results.</div>
              return (
                <div className="table-wrap">
                  <table className="t">
                    <tbody>
                      {rows.map((e) => (
                        <ResultRow key={`${e.mode}-${e.id}`} e={e} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }}
          </QueryState>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Route it**

In `src/web/App.tsx`: import `Results` and set `<Route path="results" element={<Results />} />`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS. `npm run typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Results page"
```

---

### Task 10: Tournaments page with brackets and history

**Files:**
- Create: `src/web/pages/Tournaments.tsx`, `src/web/pages/tournaments/CurrentCard.tsx`, `src/web/pages/tournaments/Bracket.tsx`, `src/web/pages/tournaments/History.tsx`
- Modify: `src/web/App.tsx`
- Test: `tests/web/tournaments.test.tsx`

**Interfaces:**
- Produces: `<Tournaments />` (routes `tournaments` and `tournaments/:id`). Shows the sync and async current tournaments (status, times, prizes, signups, matches by round), the bracket game detail for `:id`, and history with participants.

- [ ] **Step 1: Write the failing test**

`tests/web/tournaments.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { tournamentCurrent, tournamentHistory, tournamentHistoryDetail } from './helpers/fixtures'
import { Tournaments } from '../../src/web/pages/Tournaments'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
const cur = tournamentCurrent as { tournament_id: string; status: string; signups: Array<{ display_name: string }> }
const hist = tournamentHistory as Array<{ tournament_id: string; winner_display_name: string }>

describe('Tournaments', () => {
  it('shows current sync and async tournaments with signups, and the history', async () => {
    mockHub({
      '/tournaments': env({ sync: tournamentCurrent, async: { ...tournamentCurrent, kind: 'async', tournament_id: 'async-1', signups: [] } }, { errors: [] }),
      '/tournaments/history': env({ rows: tournamentHistory, detail: (tournamentHistoryDetail as { tournaments: unknown[] }).tournaments }, { errors: [] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Tournaments />, { route: '/tournaments', path: '/tournaments' })
    await waitFor(() => expect(screen.getAllByText(new RegExp(cur.status, 'i')).length).toBeGreaterThan(0))
    expect(screen.getByText(cur.signups[0].display_name)).toBeInTheDocument()
    expect(screen.getByText(/no signups yet/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText(hist[0].winner_display_name).length).toBeGreaterThan(0))
  })

  it('shows bracket game detail for a tournament id', async () => {
    mockHub({
      '/tournaments': env({ sync: null, async: null }, { errors: [] }),
      '/tournaments/history': env({ rows: [], detail: [] }, { errors: [] }),
      [`/tournaments/${hist[0].tournament_id}/bracket`]: env({ matches: [{ match_id: 'm1', games: [{ n: 1, p1_rounds: 5, p2_rounds: 2, p1_points: 2, p2_points: 0, dur: 281, p1_fps: 367, p2_fps: 234, p1_ping: 187, p2_ping: 25, p1_hit_pct: 25, p2_hit_pct: 15, p1_blk_pct: 33, p2_blk_pct: 21, p1_cards: 'Echo|Poison', p2_cards: 'Decay' }] }] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Tournaments />, { route: `/tournaments/${hist[0].tournament_id}`, path: '/tournaments/:id' })
    await waitFor(() => expect(screen.getByText(/5–2/)).toBeInTheDocument())
    expect(screen.getByText('Echo')).toBeInTheDocument()
    expect(screen.getByText('4:41')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/tournaments.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/pages/tournaments/CurrentCard.tsx`**

```tsx
import { Link } from 'react-router'
import type { TournamentCurrent, TournamentMatch } from '../../../shared/api-types'
import { PlayerLink } from '../../components/PlayerLink'
import { fmtDate, relTime } from '../../lib/format'

const STATUS_LABEL: Record<string, string> = { voting: 'Voting on a time', locked: 'Locked, starting soon', running: 'Running', completed: 'Completed' }

function when(iso: string | null | undefined): string {
  if (!iso) return '–'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '–'
  return `${fmtDate(iso)} ${new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${t > Date.now() ? 'in ' + relTime(new Date(Date.now() - (t - Date.now())).toISOString()).replace(' ago', '') : relTime(iso)})`
}

function byRound(matches: TournamentMatch[]): Array<[string, TournamentMatch[]]> {
  const map = new Map<string, TournamentMatch[]>()
  for (const m of matches) {
    const key = `${m.bracket_side === 'losers' ? 'Losers ' : m.bracket_side === 'grand' ? 'Grand final ' : ''}Round ${m.round}`
    map.set(key, [...(map.get(key) ?? []), m])
  }
  return [...map.entries()]
}

export function CurrentCard({ t, kind }: { t: TournamentCurrent | null; kind: 'sync' | 'async' }) {
  const title = kind === 'sync' ? 'Weekly sync tournament' : 'Async tournament'
  if (!t || !t.tournament_id) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <div className="empty">Nothing scheduled right now.</div>
      </div>
    )
  }
  const status = t.status ?? ''
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <span className={`chip ${status === 'running' ? 'live-pill' : ''}`} style={status !== 'running' ? { background: 'var(--bg-elev)' } : undefined}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      <div className="muted">
        {status === 'voting' ? `Voting closes ${when(t.voting_closes_at)} · default start ${when(t.default_start_ts)}` : null}
        {status === 'locked' ? `Starts ${when(t.scheduled_start_ts ?? t.default_start_ts)}` : null}
        {status === 'running' ? `Started ${when(t.started_at)}` : null}
        {status === 'completed' ? `Ended ${when(t.ended_at)}` : null}
      </div>
      {t.prize_gold_1 ? (
        <div className="faint" style={{ marginTop: 4 }}>
          Prizes: {t.prize_gold_1}g / {t.prize_gold_2}g / {t.prize_gold_3}g · {t.min_players}–{t.max_players} players
        </div>
      ) : null}

      <h3 style={{ marginTop: 12 }}>Signups ({t.signups.length})</h3>
      {t.signups.length === 0 ? <div className="faint">No signups yet.</div> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {t.signups.map((s) => (
          <li key={s.signup_id} className="row" style={{ minHeight: 32 }}>
            {s.seed ? <span className="faint mono">#{s.seed}</span> : null}
            <PlayerLink steamId={s.steam_id} name={s.display_name} title={s.title} titleColor={s.title_color} />
            <span className="muted mono">{Math.round(s.rating)}</span>
            <span className="spacer" />
            {s.placed_rank ? <span className="chip">placed #{s.placed_rank}</span> : s.forfeited ? <span className="chip bad">forfeited</span> : s.progress_label ? <span className="faint">{s.progress_label}</span> : null}
          </li>
        ))}
      </ul>

      {t.time_slot_tallies?.length ? (
        <>
          <h3 style={{ marginTop: 12 }}>Time votes</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {t.time_slot_tallies.map((v) => (
              <li key={v.slot_ts} className="row">
                <span>{when(v.slot_ts)}</span>
                <span className="muted">{v.votes} votes</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {t.matches.length ? (
        <>
          <h3 style={{ marginTop: 12 }}>Bracket</h3>
          {byRound(t.matches).map(([round, ms]) => (
            <div key={round} style={{ marginBottom: 8 }}>
              <div className="faint">{round}</div>
              {ms.map((m) => (
                <div key={m.match_id} className="row" style={{ minHeight: 32 }}>
                  <span style={{ fontWeight: m.winner_signup_id && m.winner_signup_id === m.p1_signup_id ? 800 : 500 }}>{m.p1_display_name ?? (m.is_bye ? 'bye' : 'TBD')}</span>
                  <span className="mono">
                    {m.p1_series_wins ?? 0}–{m.p2_series_wins ?? 0}
                  </span>
                  <span style={{ fontWeight: m.winner_signup_id && m.winner_signup_id === m.p2_signup_id ? 800 : 500 }}>{m.p2_display_name ?? (m.is_bye ? 'bye' : 'TBD')}</span>
                  <span className="spacer" />
                  <span className="faint">{m.status}</span>
                </div>
              ))}
            </div>
          ))}
          <Link className="btn" to={`/tournaments/${t.tournament_id}`}>
            Game details
          </Link>
        </>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/web/pages/tournaments/Bracket.tsx`**

```tsx
import { Link } from 'react-router'
import { useBracket } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { clock } from '../../lib/format'

function Chips({ joined }: { joined: string }) {
  const names = joined ? joined.split('|').filter(Boolean) : []
  if (!names.length) return <span className="faint">no picks</span>
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      {names.map((n, i) => (
        <span key={i} className="chip" style={{ background: 'var(--bg-elev)', fontWeight: 500 }}>
          {n}
        </span>
      ))}
    </span>
  )
}

export function Bracket({ id }: { id: string }) {
  const q = useBracket(id)
  return (
    <div className="card">
      <div className="card-head">
        <h2>Game details</h2>
        <Link to="/tournaments" className="muted">
          ← tournaments
        </Link>
      </div>
      <QueryState q={q} label="bracket games" empty={(d) => !d.matches?.length} emptyHint="No games have been played in this bracket yet.">
        {(d) => (
          <>
            {d.matches.map((m, i) => (
              <div key={m.match_id} style={{ marginBottom: 12 }}>
                <div className="faint">Match {i + 1}</div>
                {m.games.map((g) => (
                  <div key={g.n} style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                    <div className="row">
                      <span className="faint">Game {g.n}</span>
                      <strong className="mono">
                        {g.p1_rounds}–{g.p2_rounds}
                      </strong>
                      <span className="faint">
                        pts {g.p1_points}–{g.p2_points} · {clock(g.dur)} · hit {g.p1_hit_pct}% / {g.p2_hit_pct}% · block {g.p1_blk_pct}% / {g.p2_blk_pct}%
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className="faint">P1: </span>
                      <Chips joined={g.p1_cards} />
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className="faint">P2: </span>
                      <Chips joined={g.p2_cards} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </QueryState>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/web/pages/tournaments/History.tsx`**

```tsx
import { Link } from 'react-router'
import { useTournamentHistory } from '../../api/hooks'
import { PlayerLink } from '../../components/PlayerLink'
import { QueryState } from '../../components/QueryState'
import { fmtDate } from '../../lib/format'

export function History() {
  const q = useTournamentHistory()
  return (
    <div className="card">
      <h2>Past tournaments</h2>
      <QueryState q={q} label="tournament history" empty={(d) => !d.rows?.length}>
        {(d) => (
          <>
            {d.rows.map((r) => {
              const detail = d.detail.find((x) => x.tournament_id === r.tournament_id)
              return (
                <details key={r.tournament_id} className="card" style={{ marginBottom: 8 }}>
                  <summary className="row" style={{ cursor: 'pointer', minHeight: 40 }}>
                    <span className="chip" style={{ background: 'var(--bg-elev)' }}>{r.kind}</span>
                    <span className="faint">{r.format.replace(/_/g, ' ')}</span>
                    <span className="spacer" />
                    <span>
                      🏆 {r.winner_steam_id && r.winner_display_name ? <PlayerLink steamId={r.winner_steam_id} name={r.winner_display_name} bold /> : r.winner_display_name ?? '–'}
                    </span>
                    <span className="faint">{fmtDate(r.ended_at)}</span>
                  </summary>
                  <div className="muted" style={{ margin: '6px 0' }}>
                    2nd {r.runner_up_display_name ?? '–'} · 3rd {r.third_place_display_name ?? '–'} · {r.signup_count} players
                  </div>
                  {detail?.participants?.length ? (
                    <div className="table-wrap">
                      <table className="t">
                        <thead>
                          <tr>
                            <th className="num">Seed</th>
                            <th>Player</th>
                            <th className="num">Elo</th>
                            <th className="num">W-L</th>
                            <th>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.participants.map((p) => (
                            <tr key={p.steam_id}>
                              <td className="num mono">{p.seed}</td>
                              <td>
                                <PlayerLink steamId={p.steam_id} name={p.display_name} />
                              </td>
                              <td className="num mono">{p.elo}</td>
                              <td className="num mono">
                                {p.wins}-{p.losses}
                              </td>
                              <td className={p.placed_rank === 1 ? 'good' : p.forfeited ? 'bad' : 'muted'}>{p.result_label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <Link className="btn" style={{ marginTop: 8 }} to={`/tournaments/${r.tournament_id}`}>
                    Game details
                  </Link>
                </details>
              )
            })}
          </>
        )}
      </QueryState>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/web/pages/Tournaments.tsx`**

```tsx
import { useParams } from 'react-router'
import { useTournaments } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { Bracket } from './tournaments/Bracket'
import { CurrentCard } from './tournaments/CurrentCard'
import { History } from './tournaments/History'

export function Tournaments() {
  const { id } = useParams()
  const q = useTournaments()
  return (
    <>
      <h1>Tournaments</h1>
      <p className="muted">Sign up, vote and play from the game (F5 → Tournaments). This page is the live view.</p>
      {id && /^[0-9a-f-]{36}$/i.test(id) ? <Bracket id={id} /> : null}
      <QueryState q={q} label="tournaments">
        {(d, meta) => (
          <>
            {meta.errors.length ? <div className="banner bad">Could not load: {meta.errors.join(', ')}.</div> : null}
            <div className="grid-2">
              <CurrentCard t={d.sync} kind="sync" />
              <CurrentCard t={d.async} kind="async" />
            </div>
          </>
        )}
      </QueryState>
      <History />
    </>
  )
}
```

- [ ] **Step 7: Route it**

In `src/web/App.tsx`: import `Tournaments` and set both `<Route path="tournaments" element={<Tournaments />} />` and `<Route path="tournaments/:id" element={<Tournaments />} />`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS. `npm run typecheck` — clean.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add Tournaments page with current brackets, game details and history"
```

---

### Task 11: Cards page

**Files:**
- Create: `src/web/pages/Cards.tsx`
- Modify: `src/web/App.tsx`
- Test: `tests/web/cards.test.tsx`

**Interfaces:**
- Produces: `<Cards />` with filter (All / Ranked / Casual), sort select, a stats table, an expandable "top pickers" row per card, and "card leaders" lists (most wins and most sweeps with a card).

- [ ] **Step 1: Write the failing test**

`tests/web/cards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { cards } from './helpers/fixtures'
import { Cards } from '../../src/web/pages/Cards'

const list = cards as Array<{ card_name: string }>
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('Cards', () => {
  it('renders the table, switches filters and expands top pickers', async () => {
    const { calls } = mockHub({
      '/cards?filter=all&sort=times_picked&order=desc': env(cards),
      '/cards?filter=ranked&sort=times_picked&order=desc': env(cards.slice(0, 3)),
      '/cards/leaders': env({ sweepers: [{ card: 'Big Bullet', player: 'Stan', count: 28 }], winners: [{ card: 'Careful Planning', player: 'Sid', count: 42 }] }),
      [`/cards/${encodeURIComponent(list[0].card_name)}/pickers`]: env({ card_name: list[0].card_name, display_names: ['Sid'], steam_ids: ['76561198040410653'], picks: [537], win_rates: [0.95] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Cards />)
    await waitFor(() => expect(screen.getByText(list[0].card_name)).toBeInTheDocument())
    expect(screen.getByText('Careful Planning')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: list[0].card_name }))
    await waitFor(() => expect(screen.getByRole('link', { name: /Sid/ })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('tab', { name: 'Ranked' }))
    await waitFor(() => expect(calls).toContain('/cards?filter=ranked&sort=times_picked&order=desc'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/cards.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/pages/Cards.tsx`**

```tsx
import { Fragment, useState } from 'react'
import { useCardLeaders, useCardPickers, useCards } from '../api/hooks'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { Tabs } from '../components/Tabs'
import { num, pct } from '../lib/format'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ranked', label: 'Ranked' },
  { id: 'casual', label: 'Casual' },
]
const SORTS: Array<{ id: string; label: string }> = [
  { id: 'times_picked', label: 'Most picked' },
  { id: 'win_rate', label: 'Win rate' },
  { id: 'pass_rate', label: 'Pass rate' },
  { id: 'unique_players', label: 'Unique players' },
  { id: 'times_offered', label: 'Most offered' },
]

function Pickers({ name }: { name: string }) {
  const q = useCardPickers(name)
  return (
    <QueryState q={q} label="top pickers" empty={(d) => !d.display_names?.length}>
      {(d) => (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {d.display_names.map((n, i) => (
            <li key={d.steam_ids[i] ?? i} className="row" style={{ minHeight: 30 }}>
              <PlayerLink steamId={d.steam_ids[i]} name={n} />
              <span className="spacer" />
              <span className="muted">{d.picks[i]} picks</span>
              <span className={`mono ${d.win_rates[i] >= 0.55 ? 'good' : d.win_rates[i] <= 0.45 ? 'bad' : ''}`}>{pct(d.win_rates[i])}</span>
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  )
}

export function Cards() {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('times_picked')
  const [open, setOpen] = useState<string | null>(null)
  const order = sort === 'pass_rate' ? 'desc' : 'desc'
  const q = useCards(filter, sort, order)
  const leaders = useCardLeaders()
  return (
    <>
      <h1>Cards</h1>
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
      <div className="row" style={{ marginBottom: 10 }}>
        <label className="muted">Sort</label>
        <select className="input" style={{ maxWidth: 220 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort cards">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        <QueryState q={q} label="card stats" empty={(d) => d.length === 0}>
          {(rows) => (
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Rarity</th>
                    <th className="num">Picks</th>
                    <th className="num">Offered</th>
                    <th className="num">Pass %</th>
                    <th className="num">Win %</th>
                    <th className="num">Players</th>
                    <th className="num">Sweeps</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <Fragment key={c.card_name}>
                      <tr>
                        <td>
                          <button className="btn" style={{ minHeight: 32, padding: '0 8px' }} onClick={() => setOpen(open === c.card_name ? null : c.card_name)} aria-expanded={open === c.card_name}>
                            {c.card_name}
                          </button>
                        </td>
                        <td className="faint">{c.card_rarity}</td>
                        <td className="num">{num(c.times_picked)}</td>
                        <td className="num">{num(c.times_offered)}</td>
                        <td className="num">{pct(c.pass_rate)}</td>
                        <td className={`num ${c.win_rate >= 0.55 ? 'good' : c.win_rate <= 0.45 ? 'bad' : ''}`}>{pct(c.win_rate)}</td>
                        <td className="num">{num(c.unique_players)}</td>
                        <td className="num">{num(c.sweeps_with_card)}</td>
                      </tr>
                      {open === c.card_name ? (
                        <tr>
                          <td colSpan={8} style={{ background: 'var(--bg-elev)' }}>
                            <strong>Top pickers of {c.card_name}</strong>
                            <Pickers name={c.card_name} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Most wins with a card</h2>
          <QueryState q={leaders} label="card leaders" empty={(d) => !d.winners?.length}>
            {(d) => (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {[...d.winners].sort((a, b) => b.count - a.count).slice(0, 15).map((w, i) => (
                  <li key={i} className="row" style={{ minHeight: 30 }}>
                    <span>{w.card}</span>
                    <span className="muted">{w.player}</span>
                    <span className="spacer" />
                    <span className="mono">{w.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
        <div className="card">
          <h2>Most 5-0 sweeps with a card</h2>
          <QueryState q={leaders} label="card leaders" empty={(d) => !d.sweepers?.length}>
            {(d) => (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {[...d.sweepers].sort((a, b) => b.count - a.count).slice(0, 15).map((w, i) => (
                  <li key={i} className="row" style={{ minHeight: 30 }}>
                    <span>{w.card}</span>
                    <span className="muted">{w.player}</span>
                    <span className="spacer" />
                    <span className="mono">{w.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Route it**

In `src/web/App.tsx`: import `Cards` and set `<Route path="cards" element={<Cards />} />`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project web` — expected PASS. `npm run typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Cards page with stats, top pickers and card leaders"
```

---

### Task 12: About page

**Files:**
- Create: `src/web/pages/About.tsx`
- Modify: `src/web/App.tsx`
- Test: `tests/web/about.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/web/about.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub } from './helpers/mockHub'
import { About } from '../../src/web/pages/About'

describe('About', () => {
  it('explains the data source, privacy controls and shows the server status', async () => {
    mockHub({ '/_status': { mode: 'community', app_version: '0.1.0', features: [], auth_enabled: false, upstream: { base: 'https://competitive-rounds.duckdns.org:8444', version: { version: '1.40.3', fetched_at: null, source: 'discovered' } }, cache: { size: 3 } }, '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(<About />)
    expect(screen.getByText(/appear offline/i)).toBeInTheDocument()
    expect(screen.getByText(/hide gold/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /discord/i })).toHaveAttribute('href', 'https://discord.gg/4tsWadH6tc')
    await waitFor(() => expect(screen.getByText(/community mode/i)).toBeInTheDocument())
    expect(screen.getByText(/1\.40\.3/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project web tests/web/about.test.tsx` — expected FAIL.

- [ ] **Step 3: Write `src/web/pages/About.tsx`**

```tsx
import { useStatus } from '../api/hooks'

export function About() {
  const s = useStatus()
  const st = s.data
  return (
    <>
      <h1>About SCR Hub</h1>
      <div className="card">
        <h2>What this is</h2>
        <p>
          A browser companion for <strong>Sid's Competitive Rounds</strong>, the ranked mod for ROUNDS. It shows the same things the in-game F5 menu and the Discord bot show,
          so you can check who is online, what is being played and where you stand without launching the game.
        </p>
        <p className="muted">
          It is a community project, not affiliated with Landfall. Playing, queueing, betting, chatting and tournament signups still happen in the game and on the{' '}
          <a href="https://discord.gg/4tsWadH6tc">Competitive Rounds Discord</a>.
        </p>
      </div>
      <div className="card">
        <h2>Where the data comes from</h2>
        <p>
          Everything here is read from the mod's public API, the same data every mod client and the Discord bot receive. Nothing is collected beyond that. Live pages refresh every 15 seconds
          while the tab is visible, leaderboards every minute, and every panel shows how old its data is.
        </p>
        <ul>
          <li>
            <strong>Appear offline</strong> in the game (F5 → Settings) removes you from the online lists here too.
          </li>
          <li>
            <strong>Hide gold</strong> in the game hides your gold here as well.
          </li>
          <li>
            Your Discord name appears only if you switched on <strong>Show Discord</strong> in the game.
          </li>
          <li>Deleting your data in the game removes it here within a minute.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Pinning and signing in</h2>
        <p>
          "Find me" lets you pin your own profile in this browser, nothing more. Signing in with Discord, where enabled, looks up the player you linked in-game with <code>/link</code> and pins that
          instead. The site keeps no account data of its own.
        </p>
      </div>
      <div className="card">
        <h2>Status</h2>
        {st ? (
          <p className="muted">
            Running in {st.mode} mode, version {st.app_version}. Talking to {st.upstream.base} as mod version {st.upstream.version.version ?? 'unknown'} ({st.upstream.version.source}).
          </p>
        ) : (
          <p className="faint">Loading status…</p>
        )}
        <p className="muted">
          Get the mod: <a href="https://thunderstore.io/c/rounds/p/SidNDeed/SidsCompetitiveRounds/">Thunderstore</a> · <a href="https://github.com/SidNDeed/SidsCompetitiveRounds">GitHub</a>
        </p>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Route it and drop the placeholder**

In `src/web/App.tsx`: import `About`, set `<Route path="about" element={<About />} />`, and delete the `Placeholder` constant (every route now has a real page).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run` — expected: both projects pass. `npm run typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add About page and wire every route"
```

---

### Task 13: End-to-end smoke tests in fixture mode

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `package.json` (`test:e2e`), `.gitignore` already ignores reports

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
npm pkg set scripts.test:e2e="playwright test"
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: 'http://localhost:8090', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npx cross-env SCR_FIXTURES=1 PORT=8090 node dist/server/node.js',
    url: 'http://localhost:8090/api/_status',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['iPhone 13'] } },
  ],
})
```

- [ ] **Step 3: Write `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('home shows live data from fixtures', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Right now' })).toBeVisible()
  await expect(page.getByText('Online now')).toBeVisible()
  await expect(page.getByText(/as of/)).toBeVisible()
})

test('leaderboard renders rows and links to a profile', async ({ page }) => {
  await page.goto('/leaderboards/1v1')
  const rows = page.locator('table.t tbody tr')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeGreaterThan(5)
  await rows.first().getByRole('link').first().click()
  await expect(page).toHaveURL(/\/players\/\d{17}/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
})

test('profile tabs load', async ({ page }) => {
  await page.goto('/players/76561199311926326')
  await page.getByRole('tab', { name: '1v1 matches' }).click()
  await expect(page.getByText(/RANKED|casual/).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Achievements' }).click()
  await expect(page.getByText(/of \d+ unlocked/)).toBeVisible()
})

test('find me pins a player', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Find me' }).click()
  await page.getByRole('searchbox').fill('nic')
  await page.getByRole('option').first().click()
  await expect(page.locator('nav').getByRole('link', { name: /📌/ })).toBeVisible()
})

test('results, tournaments, cards and about render', async ({ page }) => {
  for (const [path, heading] of [
    ['/results', 'Results'],
    ['/tournaments', 'Tournaments'],
    ['/cards', 'Cards'],
    ['/about', 'About SCR Hub'],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
})

test('no horizontal page scroll on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone project only')
  for (const path of ['/', '/leaderboards/1v1', '/players/76561199311926326', '/cards']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
  }
})
```

- [ ] **Step 4: Run it**

Run: `npm run test:e2e` — expected: all tests pass on both projects. If the phone overflow test fails, the offending element is usually a table outside `.table-wrap` or a long unbroken string; fix the page, not the test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add Playwright smoke tests in fixture mode"
```

---

### Task 14: Proposal for Sid and final documentation

**Files:**
- Create: `docs/for-sid.md`
- Modify: `README.md` (deploy section: Cloudflare and Docker, plus the fixture demo)

- [ ] **Step 1: Write `docs/for-sid.md`**

```markdown
# SCR Hub — a browser companion for Sid's Competitive Rounds

Hi Sid. NotNic here. I built a website that shows what the F5 menu and the bot show — who's online, live games, leaderboards, player pages, results, tournaments, card stats — from any browser or phone, without launching the game. It only reads your public API, the same endpoints the mod and the bot already use, and it honours appear-offline, hide-gold and show-Discord exactly like the game does. Source: <repo link>. Live demo: <site link>.

## How it talks to your server

- One small server (TypeScript) sits between browsers and your API. Browsers never call your API directly.
- It sends `X-Mod-Version` (discovered from `/mod-version`, so raising the minimum never breaks it) and a `User-Agent` of `scr-hub/<version>`, so you can spot or block its traffic any time.
- It caches every response (10 s for live data, 30–60 s for boards and profiles, 10 min for reference data), coalesces identical requests, caps itself at 8 in-flight requests, and serves stale data if you're down. A hundred people looking at the site costs your API about the same as one mod client.
- It never touches player-private endpoints (inventory, bets, mail, card tiers, queue polls) and it strips Discord ids and hidden gold server-side.

## If you want to host it yourself (optional)

It's one container. Next to `api` and `bot` in your compose file:

```yaml
  web:
    build: ./scr-hub            # git clone next to the compose file
    restart: unless-stopped
    environment:
      SCR_UPSTREAM_BASE: http://api:8000
      SCR_INTERNAL_KEY: ${API_SECRET_KEY}     # or a separate key if you prefer
      BASE_PATH: /hub
      PUBLIC_BASE_URL: https://competitive-rounds.duckdns.org:8444/hub
    ports: ["127.0.0.1:8081:8080"]
```

plus in `nginx/app.conf`:

```nginx
    location /hub/ {
        proxy_pass http://web:8080/hub/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

With the internal key the server skips the version gate; nothing else in your API changes. You don't have to host it — the community instance works without any change on your side.

## The three asks (only if you like the idea)

1. **Green light.** Say you're OK with a community site reading the public API. If you'd rather it didn't, tell me and it comes down.
2. **A pull endpoint for the web, later.** The gacha system you let me playtest is the thing people would love to use from their phone. The site already has Discord sign-in. A `POST /api/v1/discord-gacha/pull` that mirrors `/discord-bets` (internal key + `discord_user_id`, resolves the linked player, runs your existing pull logic) is all the site needs. I'll build the whole UI against whatever shape you pick, and I can show you the screens with mocked pulls before you write a line.
3. **A key.** For hosted mode or for the pull endpoint: `API_SECRET_KEY`, or a separate key if you'd rather scope it.

## Even smaller alternative for gacha

A `/pull` slash command in the bot would let people pull from Discord on their phone with no website involved at all. Less nice than the site, but a much smaller change.

Thanks for reading. Happy to jump on a call or answer questions in #scr-dev.
```

Replace `<repo link>` and `<site link>` with the real URLs once the community instance is deployed (Task 15).

- [ ] **Step 2: Update `README.md`**

Replace the "Deploy" section with:

```markdown
## Deploy

### Community mode (Cloudflare Workers, free)

```bash
npx wrangler login                       # once, opens a browser
npm run build
npm run deploy:cf
npx wrangler secret put DISCORD_CLIENT_ID    # optional, enables sign-in (also CLIENT_SECRET and SESSION_SECRET)
```

Set `PUBLIC_BASE_URL` in `wrangler.toml` `[vars]` to the deployed URL and redeploy so OAuth redirects and the User-Agent carry it. Add `https://<site>/auth/discord/callback` as a redirect URL in the Discord application.

### Hosted mode (Docker, next to Sid's API)

See `docs/for-sid.md` for the compose and nginx snippets. `docker build -t scr-hub .`

### Demo without any network

```bash
npm run build && npm run preview     # http://localhost:8080 from fixtures/
```
```

- [ ] **Step 3: Commit**

```bash
git add docs/for-sid.md README.md
git commit -m "Add the proposal for Sid and deployment docs"
```

---

### Task 15: Final verification and release

- [ ] **Step 1: Full verification**

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run contract
```

Expected: all green; `npm run contract` passes against the live API (if a check fails, Sid's API changed — fix the type and consumer, then re-run).

- [ ] **Step 2: Manual review in the browser (community mode, live data)**

```bash
node dist/server/node.js &
```

Open `http://localhost:8080`, phone-width and desktop. Check: the online list matches the game's Home tab; a leaderboard row's rank chip matches the in-game tier; your own profile pins; the data-age line ticks; a profile with hide-gold shows "hidden"; theme toggle persists after reload. Stop the server.

- [ ] **Step 3: Deploy the community instance**

Follow README "Community mode". Record the deployed URL in `docs/for-sid.md` (`<site link>`) and in `wrangler.toml` `PUBLIC_BASE_URL`, redeploy, and confirm `https://<site>/api/_status?probe=1` reports `reachable: true` (spec risk 1). If not, ship the Docker image on a container host and record that outcome in the server plan under Task 17.

- [ ] **Step 4: Tag**

```bash
git add -A
git commit -m "Record the deployed community URL"
git tag v0.1.0
```

Then publish `docs/for-sid.md` as a shareable page (ask Claude to publish it as an artifact, or paste it into a Discord message) and send Sid the site link with it.

---

## Self-review notes (filled in by the plan author)

- **Spec coverage:** 7.1 stack → Task 1; 7.2 pages → Tasks 5 (Home), 6 (Leaderboards), 7–8 (Player), 9 (Results), 10 (Tournaments), 11 (Cards), 12 (About); 7.3 "me" → Task 4; 7.4 fixture mode → Tasks 5 (helpers), 13 (Playwright on the fixture server); 7.5 visual direction → Task 2 tokens; 8 client side of sign-in → Task 4; 9 deployment → Tasks 14–15 (server plan owns the config files); 10 tests → every task plus Task 13; 11 degraded states → Task 2 `QueryState`, Task 5 banners; 12 privacy → Global Constraints, Tasks 5, 7, 12; 15 deliverables → Tasks 14–15.
- **Phase 1.5 items (chat scrollback, compare view, achievements gallery, release notes) are intentionally absent** per spec 7.2.
- **Type consistency checked:** `hubGet`/`HubError`/`BASE`/`authUrl`; `Env<T>`; hook names in Task 3 match their use in Tasks 4–12; `QueryState` props `q/label/empty/emptyHint/children(data, meta)`; `PlayerLink` props; `useIdentity()` fields `me/source/discord/authEnabled/pin/unpin/signOut`; `ResultRow` exported from `pages/Home.tsx` and used by `pages/Results.tsx`; `groupSeries` → `SeriesGroup`; `CardLeader` imported from the server route module; `ActiveTeamSeries.live_t1_points?` addition noted in Task 5.
