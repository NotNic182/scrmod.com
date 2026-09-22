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
