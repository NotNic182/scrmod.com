import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { renderApp } from './helpers/render'
import { mockHub, env, jsonResponse } from './helpers/mockHub'
import { boards, cards } from './helpers/fixtures'
import { Leaderboards } from '../../src/web/pages/Leaderboards'
import { Cards } from '../../src/web/pages/Cards'
import { Card } from '../../src/web/pages/Card'
import { Player } from '../../src/web/pages/Player'
import { Tournaments } from '../../src/web/pages/Tournaments'
import { Layout } from '../../src/web/components/Layout'

vi.mock('../../src/web/components/RatingGraph', () => ({ RatingGraph: () => <div data-testid="graph" /> }))

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
const NOT_FOUND = () => jsonResponse({ error: 'not_found' }, 404)

describe('page titles and intros', () => {
  it('leaderboards: the planned title and intro, per mode', async () => {
    mockHub({ '/leaderboard/2v2': env(boards['2v2']), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/2v2', path: '/leaderboards/:mode' })
    await waitFor(() => expect(document.title).toBe('ROUNDS 2v2 ranked leaderboard: top players by rating · SCRmod'))
    expect(screen.getByText("Ranked ROUNDS players in Sid's Competitive Rounds, ordered by rating.")).toBeInTheDocument()
  })

  it('cards: title and intro', async () => {
    mockHub({ '/cards?filter=all&sort=times_picked&order=desc': env(cards), '/cards/leaders': env({ sweepers: [], winners: [] }), '/me': SIGNED_OUT })
    renderApp(<Cards />)
    await waitFor(() => expect(document.title).toBe('ROUNDS card win rates: the best cards in ranked play · SCRmod'))
    expect(screen.getByText('Win, pick and pass rates for every ROUNDS card across ranked and casual games.')).toBeInTheDocument()
  })

  it("tournaments: a game-details address takes the server's tournament title, a malformed one the list title", async () => {
    const lists = { '/tournaments': env({ sync: null, async: null }, { errors: [] }), '/tournaments/history': env({ rows: [], detail: [] }, { errors: [] }), '/me': SIGNED_OUT }
    mockHub(lists)
    const details = renderApp(<Tournaments />, { route: '/tournaments/3f2b8c1e-0000-4000-8000-000000000001', path: '/tournaments/:id' })
    await waitFor(() => expect(document.title).toBe('Tournament game details · SCRmod'))
    details.unmount()
    renderApp(<Tournaments />, { route: '/tournaments/not-a-uuid', path: '/tournaments/:id' })
    await waitFor(() => expect(document.title).toBe('ROUNDS tournaments: weekly brackets and winners · SCRmod'))
  })

  it("a card or player that does not exist takes the not-found title, as the server's 404 does", async () => {
    const ID = '76561199311926326'
    mockHub({ '/card/nope': NOT_FOUND, [`/players/${ID}`]: NOT_FOUND, '/me': SIGNED_OUT })
    const card = renderApp(<Card />, { route: '/cards/nope', path: '/cards/:slug' })
    expect(await screen.findByText(/card not found/i)).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Not found · SCRmod'))
    card.unmount()
    document.title = ''
    renderApp(<Player />, { route: `/players/${ID}`, path: '/players/:steamId' })
    expect(await screen.findByText(/player not found/i)).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Not found · SCRmod'))
  })

  it('the footer links the guide and the stream channels', () => {
    mockHub({ '/me': SIGNED_OUT })
    renderApp(
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>x</p>} />
        </Route>
      </Routes>,
    )
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/guide')
    expect(screen.getByRole('link', { name: 'Twitch' })).toHaveAttribute('href', 'https://www.twitch.tv/sidscompetitiverounds')
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@SidsCompetitiveRounds')
  })
})
