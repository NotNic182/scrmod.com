import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import multimode from '../../fixtures/series__recent-multimode.json'
import { Results } from '../../src/web/pages/Results'

const SERIES_1V1 = { series: [{ series_id: 's', game_codes: [], p1_name: 'Zezima', p1_steam_id: '76561199195193559', p1_rating: 1480.5, p1_rating_change: 19.3, p1_streak: 1, p2_name: 'Necro', p2_steam_id: '76561198228681248', p2_rating: 1297.2, p2_rating_change: -110.2, p2_streak: -3, p1_series_wins: 2, p2_series_wins: 1, winner_name: 'Zezima', winner_steam_id: '76561199195193559', completed_at: '2026-09-22T09:57:53Z', rules: null, bets: [{ bettor_name: 'Spirit', amount: 2000 }], tournament: false, tournament_label: '' }] }
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
type Entry = { mode: string; id: string }
const entries = (multimode as { entries: Entry[] }).entries
// One header row plus the body rows.
const bodyRows = () => screen.getAllByRole('row').length - 1

describe('Results', () => {
  it('renders the multimode feed and filters by mode', async () => {
    mockHub({ '/results?limit=100': env(multimode), '/results/1v1?limit=50': env(SERIES_1V1), '/me': SIGNED_OUT })
    renderApp(<Results />)
    await waitFor(() => expect(bodyRows()).toBe(entries.length))
    await userEvent.click(screen.getByRole('tab', { name: 'FFA' }))
    await waitFor(() => expect(bodyRows()).toBe(14))
    await userEvent.click(screen.getByRole('tab', { name: '1v1' }))
    await waitFor(() => expect(screen.getByText('Zezima')).toBeInTheDocument())
    expect(screen.getByText('+19.3')).toBeInTheDocument()
    expect(screen.getByText(/1 bet/)).toBeInTheDocument()
  })

  it('the 1v2 tab shows 1v2 results whether the API calls the mode "1v2" or "ovt"', async () => {
    const legacy = { ...entries.find((e) => e.mode === '1v2')!, id: 'legacy-ovt', mode: 'ovt' }
    mockHub({ '/results?limit=100': env({ ...multimode, entries: [...entries, legacy] }), '/results/1v1?limit=50': env(SERIES_1V1), '/me': SIGNED_OUT })
    renderApp(<Results />)
    await waitFor(() => expect(bodyRows()).toBe(entries.length + 1))
    await userEvent.click(screen.getByRole('tab', { name: '1v2' }))
    // The fixture has two "1v2" rows; the legacy "ovt" row makes three.
    await waitFor(() => expect(bodyRows()).toBe(3))
  })

  it('fetches (and so polls) only the feed the open tab shows', async () => {
    const { calls } = mockHub({ '/results?limit=100': env(multimode), '/results/1v1?limit=50': env(SERIES_1V1), '/me': SIGNED_OUT })
    renderApp(<Results />)
    await waitFor(() => expect(bodyRows()).toBe(entries.length))
    expect(calls).not.toContain('/results/1v1?limit=50')
    await userEvent.click(screen.getByRole('tab', { name: '1v1' }))
    await waitFor(() => expect(screen.getByText('Zezima')).toBeInTheDocument())
    expect(calls.filter((c) => c === '/results?limit=100')).toHaveLength(1)
  })

  it('the feed names its columns for screen readers', async () => {
    mockHub({ '/results?limit=100': env(multimode), '/results/1v1?limit=50': env(SERIES_1V1), '/me': SIGNED_OUT })
    renderApp(<Results />)
    await waitFor(() => expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Mode', 'Winner', 'Score', 'Against', 'When']))
  })
})
