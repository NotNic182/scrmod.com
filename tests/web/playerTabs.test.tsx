import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { profile, matches, achievements } from './helpers/fixtures'
import { Player } from '../../src/web/pages/Player'

vi.mock('../../src/web/components/RatingGraph', () => ({ RatingGraph: () => <div data-testid="graph" /> }))

const ME = '76561199311926326'
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('Player tabs', () => {
  it('renders matches grouped by series with card chips', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}/matches?limit=100`]: env(matches), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}?tab=matches`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getAllByText(/game \d/i).length).toBeGreaterThan(0))
    const first = matches[0] as { cards_picked: Array<{ card_name: string }> }
    if (first.cards_picked.length) expect(screen.getAllByText(first.cards_picked[0].card_name).length).toBeGreaterThan(0)
  })

  it('renders achievements with unlocked first', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}/achievements`]: env(achievements), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}?tab=achievements`, path: '/players/:steamId' })
    const list = achievements as { achievements: Array<{ name: string; unlocked: boolean }> }
    await waitFor(() => expect(screen.getByText(list.achievements[0].name)).toBeInTheDocument())
    const unlockedCount = list.achievements.filter((a) => a.unlocked).length
    expect(screen.getByText(new RegExp(`${unlockedCount} of ${list.achievements.length}`))).toBeInTheDocument()
  })

  it('renders 2v2, FFA and 1v2 histories from empty and filled responses', async () => {
    mockHub({
      [`/players/${ME}`]: env(profile),
      [`/players/${ME}/team-history`]: env({ series: [{ series_id: 't', won: false, score: '0-2', mate: 'MangoJuice', opponents: ['Stan', 'embargo'], rating_change: -72.9, completed_at: '2026-09-11T01:34:56Z', rules: null }] }),
      [`/players/${ME}/ffa-history`]: env({ games: [] }),
      [`/players/${ME}/ovt-history`]: env({ games: [{ match_id: 'o', role: 'duo', won: true, score: '5-4', solo: 'Stan', duo: ['Spirit', 'NotNic'], ended_at: '2026-08-20T21:16:30Z', gold_gained: 25, series_gold_gained: 0, rules: null }] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Player />, { route: `/players/${ME}?tab=2v2`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByText('MangoJuice')).toBeInTheDocument())
    renderApp(<Player />, { route: `/players/${ME}?tab=ffa`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getAllByText(/no ffa games/i).length).toBeGreaterThan(0))
    renderApp(<Player />, { route: `/players/${ME}?tab=1v2`, path: '/players/:steamId' })
    await waitFor(() => expect(screen.getByText(/Spirit/)).toBeInTheDocument())
  })
})
