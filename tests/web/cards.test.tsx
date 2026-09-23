import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { cards } from './helpers/fixtures'
import { Cards } from '../../src/web/pages/Cards'

const list = cards as Array<{ card_name: string }>
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('Cards', () => {
  it('renders the table, switches filters and expands top pickers', async () => {
    const { calls } = mockHub({
      '/cards?filter=all&sort=times_picked&order=desc': env(cards),
      '/cards?filter=ranked&sort=times_picked&order=desc': env(cards.slice(0, 3)),
      '/cards/leaders': env({ sweepers: [{ card: 'Big Bullet', player: 'Stan', count: 28 }], winners: [{ card: 'Careful Planning', player: 'Sid', count: 42 }] }),
      [`/cards/${encodeURIComponent(list[0].card_name)}/pickers`]: env({ card_name: list[0].card_name, display_names: ['Sid'], steam_ids: ['76561198040410653'], picks: [537], win_rates: [0.95] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Cards />)
    await waitFor(() => expect(screen.getByText(list[0].card_name)).toBeInTheDocument())
    expect(screen.getAllByText('Careful Planning').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: list[0].card_name })).toHaveAttribute('href', expect.stringMatching(/^\/cards\/[a-z0-9-]+$/))
    await userEvent.click(screen.getByRole('button', { name: `Top pickers of ${list[0].card_name}` }))
    await waitFor(() => expect(screen.getByRole('link', { name: /Sid/ })).toBeInTheDocument())
    const ranked = screen.getByRole('button', { name: 'Ranked' })
    await userEvent.click(ranked)
    expect(ranked).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(calls).toContain('/cards?filter=ranked&sort=times_picked&order=desc'))
  })
})
