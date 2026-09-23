import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { boards, cards } from './helpers/fixtures'
import { Leaderboards } from '../../src/web/pages/Leaderboards'
import { Cards } from '../../src/web/pages/Cards'
import { Layout } from '../../src/web/components/Layout'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

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
