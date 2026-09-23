import { lazy, useEffect, type ComponentType } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BASE } from './api/client'
import { IdentityMenu } from './components/IdentityMenu'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, refetchIntervalInBackground: false } },
})

// Storage keys keep the old scrhub.* prefix across the SCRmod rename so saved pins and themes survive.
const RELOADED = 'scrhub.chunk-reload'

/**
 * Route-level split: Home ships in the first download, every other page (and the chart library, which only the
 * player page uses) arrives as its own chunk. After a deploy, an open tab may ask for a chunk that no longer
 * exists; reload once to pick up the new build instead of showing an error.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const importer = () =>
    load().then(
      (m) => {
        try {
          sessionStorage.removeItem(RELOADED)
        } catch {
          // storage unavailable
        }
        return { default: m[name] }
      },
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
  return { Component: lazy(importer), prefetch: load }
}

const Leaderboards = page(() => import('./pages/Leaderboards'), 'Leaderboards')
const Player = page(() => import('./pages/Player'), 'Player')
const Results = page(() => import('./pages/Results'), 'Results')
const Tournaments = page(() => import('./pages/Tournaments'), 'Tournaments')
const Cards = page(() => import('./pages/Cards'), 'Cards')
const About = page(() => import('./pages/About'), 'About')
const NotFound = page(() => import('./pages/NotFound'), 'NotFound')
const LAZY = [Leaderboards, Player, Results, Tournaments, Cards, About, NotFound]

/** Once the first page is up and the browser is idle, fetch the other pages so navigating never waits. */
function usePrefetchPages() {
  useEffect(() => {
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
            <Route path="about" element={<About.Component />} />
            <Route path="*" element={<NotFound.Component />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
