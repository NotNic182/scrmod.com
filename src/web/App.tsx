import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BASE } from './api/client'
import { IdentityMenu } from './components/IdentityMenu'
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { Cards } from './pages/Cards'
import { Home } from './pages/Home'
import { Leaderboards } from './pages/Leaderboards'
import { NotFound } from './pages/NotFound'
import { Player } from './pages/Player'
import { Results } from './pages/Results'
import { Tournaments } from './pages/Tournaments'

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, refetchIntervalInBackground: false } },
})

export function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter basename={BASE || '/'}>
        <Routes>
          <Route element={<Layout identity={<IdentityMenu />} />}>
            <Route index element={<Home />} />
            <Route path="leaderboards" element={<Navigate to="/leaderboards/1v1" replace />} />
            <Route path="leaderboards/:mode" element={<Leaderboards />} />
            <Route path="players/:steamId" element={<Player />} />
            <Route path="results" element={<Results />} />
            <Route path="tournaments" element={<Tournaments />} />
            <Route path="tournaments/:id" element={<Tournaments />} />
            <Route path="cards" element={<Cards />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
