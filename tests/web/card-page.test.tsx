import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env, jsonResponse } from './helpers/mockHub'
import { Card } from '../../src/web/pages/Card'

const data = {
  slug: 'big-bullet',
  card: { card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 1234, win_rate: 0.523, pass_rate: 0.31, times_offered: 2000, unique_players: 70, sweeps_with_card: 9 },
  ranked: { card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 500, win_rate: 0.6, pass_rate: 0.3, times_offered: 800, unique_players: 40, sweeps_with_card: 4 },
  casual: null,
  winners: [{ card: 'Big Bullet', player: 'Stan', count: 50 }],
  sweepers: [],
  prev: { name: 'Poison', slug: 'poison' },
  next: null,
}

describe('Card page', () => {
  it('shows the card, its ranked split, leaders and neighbours', async () => {
    mockHub({ '/card/big-bullet': env(data), '/cards/Big%20Bullet/pickers': env({ card_name: 'Big Bullet', display_names: [], steam_ids: [], picks: [], win_rates: [] }) })
    renderApp(<Card />, { route: '/cards/big-bullet', path: '/cards/:slug' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Big Bullet' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Big Bullet: ROUNDS card win rate and stats · SCRmod'))
    const overall = screen.getByRole('region', { name: 'All games' })
    expect(within(overall).getByText('52%')).toBeInTheDocument()
    expect(within(overall).getByText('1,234')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Ranked games' })).getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('Stan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Poison' })).toHaveAttribute('href', '/cards/poison')
  })

  it('says so when the card does not exist', async () => {
    mockHub({ '/card/nope': () => jsonResponse({ error: 'not_found' }, 404) })
    renderApp(<Card />, { route: '/cards/nope', path: '/cards/:slug' })
    expect(await screen.findByText(/card not found/i)).toBeInTheDocument()
  })
})
