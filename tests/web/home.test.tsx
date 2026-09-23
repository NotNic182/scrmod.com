import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { homeEnvelope } from './helpers/fixtures'
import { Home } from '../../src/web/pages/Home'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('Home', () => {
  it('shows who is online, queue counts, the live series and latest results', async () => {
    mockHub({ '/home': homeEnvelope(), '/me': SIGNED_OUT })
    renderApp(<Home />)
    await waitFor(() => expect(screen.getByText(/online now/i)).toBeInTheDocument())
    expect(screen.getByText(/1 searching/i)).toBeInTheDocument()
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /NotNic/ }).length).toBeGreaterThan(0)
    expect(screen.getByText('Sync Tournament - Round 1')).toBeInTheDocument()
    expect(screen.getByText(/latest results/i)).toBeInTheDocument()
  })

  it('shows maintenance and alert banners', async () => {
    mockHub({ '/home': homeEnvelope({ maintenance: true, alerts: [{ message: 'Update tonight', expires_at: null }] }), '/me': SIGNED_OUT })
    renderApp(<Home />)
    await waitFor(() => expect(screen.getByText(/maintenance/i)).toBeInTheDocument())
    expect(screen.getByText('Update tonight')).toBeInTheDocument()
  })

  it('renders empty live sections without crashing when nothing is on', async () => {
    mockHub({ '/home': homeEnvelope({ live: { series_1v1: [], series_2v2: [], ffa_lobbies: [], spectate: [] }, results: [] }), '/me': SIGNED_OUT })
    renderApp(<Home />)
    await waitFor(() => expect(screen.getByText(/no live games/i)).toBeInTheDocument())
  })

  it('links the live stream card to the Watch tab', async () => {
    mockHub({
      '/home': homeEnvelope(),
      '/me': SIGNED_OUT,
      '/stream': env({
        live: { platform: 'twitch', title: 'Ranked night', viewers: 10, started_at: new Date().toISOString(), url: 'https://www.twitch.tv/sidscompetitiverounds', embed: { kind: 'twitch', channel: 'sidscompetitiverounds' } },
        recent: [],
        links: { twitch: 'https://www.twitch.tv/sidscompetitiverounds', youtube: 'https://www.youtube.com/@SidsCompetitiveRounds' },
      }),
    })
    renderApp(<Home />)
    expect(await screen.findByRole('link', { name: 'More on Watch' })).toHaveAttribute('href', '/watch')
  })
})
