import { describe, it, expect, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { boards, matches, tournamentHistory, tournamentHistoryDetail } from './helpers/fixtures'
import { App, preloadRoute } from '../../src/web/App'
import { Matches } from '../../src/web/pages/player/Matches'
import { History } from '../../src/web/pages/tournaments/History'
import { shouldPrefetch } from '../../src/web/lib/network'

const ME = '76561199311926326'
const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }

/** Opens a <details> the way the browser does: set open, then the toggle event. */
function open(d: HTMLDetailsElement) {
  d.open = true
  fireEvent(d, new Event('toggle'))
}

describe('perf: expandable rows build their contents when opened', () => {
  it('a match series renders its games only once it is opened', async () => {
    mockHub({ [`/players/${ME}/matches?limit=100`]: env(matches) })
    renderApp(<Matches steamId={ME} />)
    await waitFor(() => expect(document.querySelectorAll('details.acc').length).toBeGreaterThan(10))
    expect(document.querySelectorAll('.card-chip')).toHaveLength(0)
    const first = document.querySelector<HTMLDetailsElement>('details.acc')!
    open(first)
    await waitFor(() => expect(first.querySelectorAll('.card-chip').length).toBeGreaterThan(0))
    expect(document.querySelectorAll('details.acc .card-chip').length).toBe(first.querySelectorAll('.card-chip').length)
  })

  it('a past tournament renders its standings only once it is opened', async () => {
    mockHub({ '/tournaments/history': env({ rows: tournamentHistory, detail: (tournamentHistoryDetail as { tournaments: unknown[] }).tournaments }, { errors: [] }) })
    renderApp(<History />)
    await waitFor(() => expect(document.querySelectorAll('details.acc').length).toBeGreaterThan(0))
    expect(document.querySelectorAll('details.acc table')).toHaveLength(0)
    const first = document.querySelector<HTMLDetailsElement>('details.acc')!
    open(first)
    await waitFor(() => expect(first.querySelector('table')).not.toBeNull())
  })
})

describe('perf: the first page', () => {
  afterEach(() => window.history.pushState({}, '', '/'))

  it('renders with its code already loaded: no loading placeholder for React to hold back', async () => {
    window.history.pushState({}, '', '/leaderboards/1v1')
    mockHub({ '/leaderboard/1v1': env(boards['1v1']), '/me': SIGNED_OUT, '/meta': env({ rank_tiers: [] }) })
    await preloadRoute(window.location.pathname)
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Leaderboards' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading page')).toBeNull()
  })

  it('home has no page chunk to wait for', async () => {
    await expect(preloadRoute('/')).resolves.toBeUndefined()
  })
})

describe('perf: background page downloads', () => {
  it('are skipped when the visitor asked to save data or is on 2G', () => {
    expect(shouldPrefetch({})).toBe(true)
    expect(shouldPrefetch({ connection: { effectiveType: '4g', saveData: false } })).toBe(true)
    expect(shouldPrefetch({ connection: { saveData: true } })).toBe(false)
    expect(shouldPrefetch({ connection: { effectiveType: '2g' } })).toBe(false)
    expect(shouldPrefetch({ connection: { effectiveType: 'slow-2g' } })).toBe(false)
  })
})
