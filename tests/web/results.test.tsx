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
