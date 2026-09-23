import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { boards, cards, homeEnvelope, matches, profile } from './helpers/fixtures'
import { Home } from '../../src/web/pages/Home'
import { Cards } from '../../src/web/pages/Cards'
import { Matches } from '../../src/web/pages/player/Matches'
import { Player } from '../../src/web/pages/Player'
import { Leaderboards } from '../../src/web/pages/Leaderboards'

vi.mock('../../src/web/components/RatingGraph', () => ({ RatingGraph: () => <div data-testid="graph" /> }))

const ME = '76561199311926326'
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

describe('structure: long lists open with their first few and a Show all', () => {
  it('home lists 5 of the 15 recently online players until asked for all', async () => {
    mockHub({ '/home': homeEnvelope(), '/me': SIGNED_OUT })
    renderApp(<Home />)
    const list = await screen.findByRole('list', { name: /recently online/i })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    const more = screen.getByRole('button', { name: 'Show all 15' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(more)
    expect(within(list).getAllByRole('listitem')).toHaveLength(15)
    expect(more).toHaveTextContent('Show fewer')
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(more).toHaveFocus()
  })

  it('the cards table shows 20 of 68 cards until asked for all', async () => {
    mockHub({ '/cards?filter=all&sort=times_picked&order=desc': env(cards), '/cards/leaders': env({ sweepers: [], winners: [] }), '/me': SIGNED_OUT })
    renderApp(<Cards />)
    const table = await screen.findByRole('table')
    // One header row plus the card rows.
    expect(within(table).getAllByRole('row')).toHaveLength(21)
    await userEvent.click(screen.getByRole('button', { name: 'Show all 68' }))
    expect(within(table).getAllByRole('row')).toHaveLength(69)
  })

  it('match history shows 20 of 65 series until asked for all', async () => {
    mockHub({ [`/players/${ME}/matches?limit=100`]: env(matches) })
    renderApp(<Matches steamId={ME} />)
    await waitFor(() => expect(document.querySelectorAll('details.acc')).toHaveLength(20))
    await userEvent.click(screen.getByRole('button', { name: 'Show all 65' }))
    expect(document.querySelectorAll('details.acc')).toHaveLength(65)
  })
})

describe('structure: the profile header carries the ranked summary on every tab', () => {
  it('rating, standing, series record, streak and recent form sit in the header; the tiles below are grouped', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}`, path: '/players/:steamId' })
    const head = await screen.findByRole('region', { name: 'NotNic' })
    expect(within(head).getByText('1102')).toBeInTheDocument()
    expect(within(head).getByText('#189')).toBeInTheDocument()
    expect(within(head).getByText('45-95')).toBeInTheDocument()
    expect(within(head).getByText('+2')).toBeInTheDocument()
    expect(within(head).getByRole('group', { name: /recent form/i })).toBeInTheDocument()

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('heading', { name: 'Other modes' })).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: 'Career' })).toBeInTheDocument()
    expect(within(panel).queryByText('Standing')).toBeNull()
  })

  it('the header summary stays on other tabs', async () => {
    mockHub({ [`/players/${ME}`]: env(profile), [`/players/${ME}/achievements`]: env({ achievements: [] }), '/me': SIGNED_OUT })
    renderApp(<Player />, { route: `/players/${ME}?tab=achievements`, path: '/players/:steamId' })
    const head = await screen.findByRole('region', { name: 'NotNic' })
    expect(within(head).getByText('1102')).toBeInTheDocument()
  })
})

describe('structure: the leaderboard pager', () => {
  it('repeats below the table, and only the top page count is announced', async () => {
    mockHub({ '/leaderboard/1v1': env(boards['1v1']), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/1v1', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Next page' })).toHaveLength(2))
    const [, bottomNext] = screen.getAllByRole('button', { name: 'Next page' })
    await userEvent.click(bottomNext)
    expect(screen.getAllByText(/2 \/ 2/)).toHaveLength(2)
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1)
  })
})
