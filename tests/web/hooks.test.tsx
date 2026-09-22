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
    const { calls } = mockHub({
      '/players/76561199311926326?me=76561198040410653': env({ display_name: 'NotNic' }),
      '/players/76561199311926326': env({ display_name: 'NotNic' }),
    })
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
    const { calls } = mockHub({ '/players/search?q=nic+t': env({ results: [] }) })
    const { result: idle } = renderHook(() => useSearch('  '), { wrapper: wrapper() })
    expect(idle.current.fetchStatus).toBe('idle')
    const { result } = renderHook(() => useSearch('nic t'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(calls[0]).toBe('/players/search?q=nic+t')
  })
})
