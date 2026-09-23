import { createElement, lazy, useEffect, useState, type ComponentType } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BASE } from './api/client'
import { IdentityMenu } from './components/IdentityMenu'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { shouldPrefetch } from './lib/network'

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, refetchIntervalInBackground: false } },
})

// Storage keys keep the old scrhub.* prefix across the SCRmod rename so saved pins and themes survive.
const RELOADED = 'scrhub.chunk-reload'

/**
 * Route-level split: Home ships in the first download, every other page (and the chart library, which only the
 * player page uses) arrives as its own chunk. After a deploy, an open tab may ask for a chunk that no longer
 * exists; reload once to pick up the new build instead of showing an error.
 *
 * A page whose code is already here (the entry page, preloaded before the first render, or one fetched in the
 * background) renders directly. Through React.lazy it would suspend for a moment anyway, and React keeps a
 * suspended page on its loading placeholder for at least 300ms: on a fast connection, most of the wait.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  let loaded: ComponentType | null = null
  const settle = (m: Record<K, ComponentType>) => {
    loaded = m[name]
    try {
      sessionStorage.removeItem(RELOADED)
    } catch {
      // storage unavailable
    }
    return m
  }
  const fetchModule = () =>
    load().then(
      settle,
      (err: unknown) => {
        let tried = true
        try {
          tried = sessionStorage.getItem(RELOADED) === '1'
          sessionStorage.setItem(RELOADED, '1')
        } catch {
          // storage unavailable: don't risk a reload loop
        }
        if (!tried) location.reload()
        throw err
      },
    )
  const Lazy = lazy<ComponentType>(() => fetchModule().then((m) => ({ default: m[name] })))
  function Component() {
    // Decided once per visit to the page: switching from Lazy to direct mid-visit would remount it and lose its state.
    const [ready] = useState(() => loaded)
    return ready ? createElement(ready) : createElement(Lazy)
  }
  // prefetch: a background download; if it fails, the real visit to the page deals with it (and may reload).
  return { Component, preload: fetchModule, prefetch: () => load().then(settle) }
}

const Leaderboards = page(() => import('./pages/Leaderboards'), 'Leaderboards')
const Player = page(() => import('./pages/Player'), 'Player')
const Results = page(() => import('./pages/Results'), 'Results')
const Tournaments = page(() => import('./pages/Tournaments'), 'Tournaments')
const Cards = page(() => import('./pages/Cards'), 'Cards')
const Card = page(() => import('./pages/Card'), 'Card')
const Guide = page(() => import('./pages/Guide'), 'Guide')
const About = page(() => import('./pages/About'), 'About')
const NotFound = page(() => import('./pages/NotFound'), 'NotFound')
const LAZY = [Leaderboards, Player, Results, Tournaments, Cards, Card, Guide, About, NotFound]

/** Which page's code a path needs (mirrors the <Routes> below). Home is in the main bundle. */
const ROUTE_PAGES: Array<[RegExp, (typeof LAZY)[number]]> = [
  [/^\/leaderboards(\/|$)/, Leaderboards],
  [/^\/players\//, Player],
  [/^\/results\/?$/, Results],
  [/^\/tournaments(\/|$)/, Tournaments],
  [/^\/cards\/[^/]+\/?$/, Card],
  [/^\/cards\/?$/, Cards],
  [/^\/guide\/?$/, Guide],
  [/^\/about\/?$/, About],
]

/** Downloads the code for the page at `pathname`, so main.tsx can render the entry page in one go. Never rejects. */
export async function preloadRoute(pathname: string): Promise<void> {
  const path = (pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname) || '/'
  if (path === '/') return
  const target = ROUTE_PAGES.find(([re]) => re.test(path))?.[1] ?? NotFound
  await target.preload().then(
    () => undefined,
    () => undefined,
  )
}

/** Once the first page is up and the browser is idle, fetch the other pages so navigating never waits. */
function usePrefetchPages() {
  useEffect(() => {
    if (!shouldPrefetch(navigator as { connection?: { saveData?: boolean; effectiveType?: string } })) return
    const run = () => LAZY.forEach((p) => void p.prefetch().catch(() => undefined))
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(run, { timeout: 4000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 2000)
    return () => clearTimeout(id)
  }, [])
}

export function App() {
  usePrefetchPages()
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter basename={BASE || '/'}>
        <Routes>
          <Route element={<Layout identity={<IdentityMenu />} />}>
            <Route index element={<Home />} />
            <Route path="leaderboards" element={<Navigate to="/leaderboards/1v1" replace />} />
            <Route path="leaderboards/:mode" element={<Leaderboards.Component />} />
            <Route path="players/:steamId" element={<Player.Component />} />
            <Route path="results" element={<Results.Component />} />
            <Route path="tournaments" element={<Tournaments.Component />} />
            <Route path="tournaments/:id" element={<Tournaments.Component />} />
            <Route path="cards" element={<Cards.Component />} />
            <Route path="cards/:slug" element={<Card.Component />} />
            <Route path="guide" element={<Guide.Component />} />
            <Route path="about" element={<About.Component />} />
            <Route path="*" element={<NotFound.Component />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
