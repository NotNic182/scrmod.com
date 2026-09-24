import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { profile, matches } from './helpers/fixtures'
import type { HubProfile } from '../../src/web/api/types'
import { HeadToHead } from '../../src/web/pages/player/HeadToHead'
import { Player } from '../../src/web/pages/Player'

vi.mock('../../src/web/components/RatingGraph', () => ({ RatingGraph: () => <div data-testid="graph" /> }))

const ME = '76561199311926326'
const SID = '76561198040410653'
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
const ranked = (matches as Array<{ is_ranked: boolean }>).filter((m) => m.is_ranked)

// Casual games stay off profiles (Sid's call): the server drops them, and the page has no place for them.
describe('casual games on profiles', () => {
  it('the overview has no casual record', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    await screen.findByTestId('graph')
    expect(screen.queryByText('Casual')).not.toBeInTheDocument()
  })

  it('match history has no ranked/casual filter and no per-series kind label', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}/matches?limit=100`]: env(ranked), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}?tab=matches`, path: '/players/:steamId' })
    await waitFor(() => expect(document.querySelectorAll('details.acc').length).toBeGreaterThan(0))
    expect(screen.queryByRole('group', { name: 'Games shown' })).not.toBeInTheDocument()
    expect(screen.queryByText('CASUAL')).not.toBeInTheDocument()
    expect(screen.queryByText('RANKED')).not.toBeInTheDocument()
  })

  it('match history says so when there are no ranked matches', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}/matches?limit=100`]: env([]), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}?tab=matches`, path: '/players/:steamId' })
    expect(await screen.findByText('No ranked matches right now.')).toBeInTheDocument()
  })

  it('head-to-head shows ranked records only', async () => {
    const p = profile as unknown as HubProfile
    mockHub({ [`/players/${p.steam_id}/vs/${SID}`]: env({ player_steam_id: p.steam_id, opponent_steam_id: SID, player_cards: [], opponent_cards: [] }) })
    renderApp(<HeadToHead p={p} me={SID} />)
    expect(screen.getByText('Ranked games')).toBeInTheDocument()
    expect(screen.queryByText('Casual games')).not.toBeInTheDocument()
  })
})
