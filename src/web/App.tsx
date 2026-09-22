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
