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
