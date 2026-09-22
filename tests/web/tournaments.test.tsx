import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { tournamentCurrent, tournamentHistory, tournamentHistoryDetail } from './helpers/fixtures'
import { Tournaments } from '../../src/web/pages/Tournaments'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
const cur = tournamentCurrent as { tournament_id: string; status: string; signups: Array<{ display_name: string }> }
const hist = tournamentHistory as Array<{ tournament_id: string; winner_display_name: string }>

describe('Tournaments', () => {
  it('shows current sync and async tournaments with signups, and the history', async () => {
    mockHub({
      '/tournaments': env({ sync: tournamentCurrent, async: { ...tournamentCurrent, kind: 'async', tournament_id: 'async-1', signups: [] } }, { errors: [] }),
      '/tournaments/history': env({ rows: tournamentHistory, detail: (tournamentHistoryDetail as { tournaments: unknown[] }).tournaments }, { errors: [] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Tournaments />, { route: '/tournaments', path: '/tournaments' })
    await waitFor(() => expect(screen.getAllByText(new RegExp(cur.status, 'i')).length).toBeGreaterThan(0))
    expect(screen.getByText(cur.signups[0].display_name)).toBeInTheDocument()
    expect(screen.getByText(/no signups yet/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText(hist[0].winner_display_name).length).toBeGreaterThan(0))
  })

  it('shows bracket game detail for a tournament id', async () => {
    mockHub({
      '/tournaments': env({ sync: null, async: null }, { errors: [] }),
      '/tournaments/history': env({ rows: [], detail: [] }, { errors: [] }),
      [`/tournaments/${hist[0].tournament_id}/bracket`]: env({ matches: [{ match_id: 'm1', games: [{ n: 1, p1_rounds: 5, p2_rounds: 2, p1_points: 2, p2_points: 0, dur: 281, p1_fps: 367, p2_fps: 234, p1_ping: 187, p2_ping: 25, p1_hit_pct: 25, p2_hit_pct: 15, p1_blk_pct: 33, p2_blk_pct: 21, p1_cards: 'Echo|Poison', p2_cards: 'Decay' }] }] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Tournaments />, { route: `/tournaments/${hist[0].tournament_id}`, path: '/tournaments/:id' })
    await waitFor(() => expect(screen.getByText(/5–2/)).toBeInTheDocument())
    expect(screen.getByText('Echo')).toBeInTheDocument()
    expect(screen.getByText(/4:41/)).toBeInTheDocument()
  })
})
