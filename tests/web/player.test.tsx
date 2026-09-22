import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { profile } from './helpers/fixtures'
import { writePinned } from '../../src/web/lib/identity'
import { Player } from '../../src/web/pages/Player'

vi.mock('../../src/web/components/RatingGraph', () => ({ RatingGraph: () => <div data-testid="graph" /> }))

const ME = '76561199311926326'
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
const p = profile as { display_name: string; rating: number; peak_rating: number; ranked_series_wins: number; ranked_series_losses: number; level: number }

describe('Player', () => {
  it('renders the header, tiles, form and graph, never a Discord id or gold when hidden', async () => {
    mockHub({ [`/players/${ME}`]: env({ ...profile, gold_hidden: true, gold_earned: undefined, gold_spent: undefined }), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: new RegExp(p.display_name) })).toBeInTheDocument())
    expect(screen.getByText(String(Math.round(p.rating)))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`peak ${Math.round(p.peak_rating)}`))).toBeInTheDocument()
    expect(screen.getByText(`${p.ranked_series_wins}-${p.ranked_series_losses}`)).toBeInTheDocument()
    expect(screen.getByTestId('graph')).toBeInTheDocument()
    expect(screen.getByText('hidden')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('1299197810780143656')
    expect(screen.queryByLabelText(/online/)).not.toBeInTheDocument()
  })

  it('offers "pin as me" and requests the profile with me= once pinned', async () => {
    const calls = mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}?me=76561198040410653`]: env(profile), '/me': SIGNED_OUT }).calls
    writePinned({ steam_id: '76561198040410653', display_name: 'Sid' })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    await waitFor(() => expect(calls).toContain(`/players/${ME}?me=76561198040410653`))
    await userEvent.click(await screen.findByRole('button', { name: /this is me/i }))
    await waitFor(() => expect(screen.getByText(/\(you\)/)).toBeInTheDocument())
    localStorage.clear()
  })

  it('shows a not-found state for an unknown player and rejects a malformed id', async () => {
    mockHub({ [`/players/${ME}`]: () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
    renderApp(<Player />, { route: '/players/abc', path: '/players/:steamId' })
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument()
  })
})
