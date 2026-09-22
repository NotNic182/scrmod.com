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
