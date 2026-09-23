import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@tanstack/react-query'
import { renderApp } from './helpers/render'
import { mockHub, env, jsonResponse } from './helpers/mockHub'
import { boards, LIVE_1V1, matches, profile, tournamentCurrent, tournamentHistory } from './helpers/fixtures'
import { hubGet } from '../../src/web/api/client'
import type { HubProfile } from '../../src/web/api/types'
import { QueryState } from '../../src/web/components/QueryState'
import { FfaLobbyCard, LiveSeries1v1, SpectateCard } from '../../src/web/components/LiveSeriesCard'
import { Leaderboards } from '../../src/web/pages/Leaderboards'
import { Matches } from '../../src/web/pages/player/Matches'
import { HeadToHead } from '../../src/web/pages/player/HeadToHead'
import { CurrentCard } from '../../src/web/pages/tournaments/CurrentCard'
import { History } from '../../src/web/pages/tournaments/History'
import { Cards } from '../../src/web/pages/Cards'
import { TeamHistoryTab } from '../../src/web/pages/player/TeamHistory'
import { FfaHistoryTab } from '../../src/web/pages/player/FfaHistory'
import { OvtHistoryTab } from '../../src/web/pages/player/OvtHistory'
import { SearchBox } from '../../src/web/components/SearchBox'
import { IdentityMenu } from '../../src/web/components/IdentityMenu'
import { writePinned } from '../../src/web/lib/identity'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: false }
const ME = '76561199311926326'
const SID = '76561198040410653'
const RTL_NAME = 'שלום'

describe('harden: busy and exhausted controls keep keyboard focus', () => {
  beforeEach(() => localStorage.clear())

  it('the last page\'s Next button stays focusable and does nothing when pressed', async () => {
    mockHub({ '/leaderboard/1v1': env(boards['1v1']), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/1v1', path: '/leaderboards/:mode' })
    const [next] = await screen.findAllByRole('button', { name: 'Next page' })
    await userEvent.click(next) // 97 players: page 2 of 2
    expect(screen.getAllByText(/2 \/ 2/)[0]).toBeInTheDocument()
    next.focus()
    expect(next).toHaveFocus()
    expect(next).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(next)
    expect(screen.getAllByText(/2 \/ 2/)[0]).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Previous page' })[0]).not.toHaveAttribute('aria-disabled', 'true')
    // The new page number is announced, since the rows change far from the button that was pressed.
    expect(screen.getAllByText(/2 \/ 2/)[0].closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('a retry in flight keeps focus on its button and ignores repeat presses', async () => {
    let fail = true
    const { calls } = mockHub({ '/slow': () => (fail ? jsonResponse({ error: 'boom' }, 500) : new Promise<Response>(() => undefined)) })
    function Slow() {
      const q = useQuery({ queryKey: ['slow'], queryFn: () => hubGet<{ data: unknown; fetched_at: string; stale: boolean }>('/slow') })
      return <QueryState q={q} label="widget">{() => null}</QueryState>
    }
    renderApp(<Slow />)
    const retry = await screen.findByRole('button', { name: 'Try again' })
    fail = false
    await userEvent.click(retry)
    const busy = await screen.findByRole('button', { name: 'Retrying…' })
    busy.focus()
    expect(busy).toHaveFocus()
    const before = calls.length
    await userEvent.click(busy)
    expect(calls.length).toBe(before)
  })

  it('search\'s Try again hands focus back to the search field', async () => {
    mockHub({ '/players/search?q=zz': () => jsonResponse({ error: 'boom' }, 500) })
    renderApp(<SearchBox onSelect={() => undefined} />)
    await userEvent.type(screen.getByRole('combobox'), 'zz')
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('combobox')).toHaveFocus()
  })
})

describe('harden: partial API data never crashes a page', () => {
  it('a leaderboard row without a name survives the name filter', async () => {
    const lb = boards['1v1'] as { entries: Array<Record<string, unknown>> }
    const nameless = { ...lb, entries: [{ ...lb.entries[0], display_name: null }, ...lb.entries.slice(1)] }
    mockHub({ '/leaderboard/1v1': env(nameless), '/me': SIGNED_OUT })
    renderApp(<Leaderboards />, { route: '/leaderboards/1v1', path: '/leaderboards/:mode' })
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await userEvent.type(screen.getByRole('searchbox'), String(lb.entries[1].display_name))
    expect(screen.getByRole('link', { name: String(lb.entries[1].display_name) })).toBeInTheDocument()
  })

  it('live cards with missing odds, members or age render without "undefined" or a crash', () => {
    renderApp(
      <>
        <LiveSeries1v1 s={{ ...LIVE_1V1, bets_locked: false, p1_odds: undefined, p2_odds: undefined } as unknown as typeof LIVE_1V1} />
        <FfaLobbyCard l={{ lobby_id: 'l', host_name: 'Host', player_count: 2, max_players: 8, has_password: false } as never} />
        <SpectateCard g={{ game_id: 'g', names: 'A, B', spectatable: false } as never} />
      </>,
    )
    expect(screen.getByText(/Host/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/undefined|NaN/)
  })

  it('a current tournament without signups or matches lists still renders', () => {
    const bare = { ...(tournamentCurrent as object), signups: undefined, matches: undefined, time_slot_tallies: undefined }
    renderApp(<CurrentCard t={bare as never} kind="sync" />)
    expect(screen.getByText(/no signups yet/i)).toBeInTheDocument()
  })

  it('head-to-head copes with one side missing its card list, and names its columns', async () => {
    const p = profile as unknown as HubProfile
    mockHub({ [`/players/${p.steam_id}/vs/${SID}`]: env({ player_steam_id: p.steam_id, opponent_steam_id: SID, player_cards: [{ card_name: 'Echo', picks: 4, wins: 3 }] }) })
    renderApp(<HeadToHead p={p} me={SID} />)
    await screen.findByText('Echo')
    expect(screen.getAllByRole('columnheader', { name: 'Card' }).length).toBeGreaterThan(0)
  })
})

describe('harden: meaning that was carried only by opacity or a tooltip', () => {
  it('a rolled card pick says so in text, not just by fading', async () => {
    const rolled = matches.map((m, i) => (i === 0 ? { ...m, cards_picked: [{ card_name: 'Defender', card_rarity: 'Uncommon', pick_order: 1, round_number: 1, rolled: true }] } : m))
    mockHub({ [`/players/${ME}/matches?limit=100`]: env(rolled) })
    renderApp(<Matches steamId={ME} />)
    // The newest series holds the rolled pick; its games are built when the row is opened.
    await waitFor(() => expect(document.querySelector('details.acc')).not.toBeNull())
    const first = document.querySelector<HTMLDetailsElement>('details.acc')!
    first.open = true
    fireEvent(first, new Event('toggle'))
    const chip = (await screen.findAllByText('Defender')).find((el) => el.closest('.card-chip'))!.closest('.card-chip') as HTMLElement
    expect(chip).toHaveTextContent(/rolled/i)
    expect(chip.style.opacity).toBe('')
  })

  it('a decided bracket match names its winner in text, not just in bold', () => {
    const t = tournamentCurrent as { matches: Array<Record<string, unknown>> }
    const m = { ...t.matches[0], p1_signup_id: 'a', p2_signup_id: 'b', p1_display_name: 'Ann', p2_display_name: 'Bo', winner_signup_id: 'b', is_bye: false }
    renderApp(<CurrentCard t={{ ...t, matches: [m] } as never} kind="sync" />)
    expect(screen.getByText('Bo').closest('.slot')).toHaveTextContent(/Bo.*won/)
    expect(screen.getByText('Ann').closest('.slot')).not.toHaveTextContent(/won/)
  })
})

describe('harden: player names in running text are isolated for right-to-left scripts', () => {
  it('bracket rows', () => {
    const t = tournamentCurrent as { matches: Array<Record<string, unknown>> }
    const withRtl = { ...t, matches: [{ ...t.matches[0], p1_display_name: RTL_NAME }] }
    renderApp(<CurrentCard t={withRtl as never} kind="sync" />)
    expect(screen.getByText(RTL_NAME).tagName).toBe('BDI')
  })

  it('past tournament podium', async () => {
    const rows = tournamentHistory as Array<Record<string, unknown>>
    mockHub({ '/tournaments/history': env({ rows: [{ ...rows[0], runner_up_display_name: RTL_NAME }], detail: [] }, { errors: [] }) })
    renderApp(<History />)
    expect((await screen.findByText(RTL_NAME)).tagName).toBe('BDI')
  })

  it('card leaders', async () => {
    mockHub({
      '/cards?filter=all&sort=times_picked&order=desc': env([]),
      '/cards/leaders': env({ sweepers: [], winners: [{ card: 'Careful Planning', player: RTL_NAME, count: 42 }] }),
      '/me': SIGNED_OUT,
    })
    renderApp(<Cards />)
    expect((await screen.findByText(RTL_NAME)).tagName).toBe('BDI')
  })

  it('2v2, FFA and 1v2 history rows', async () => {
    const t = { completed_at: '2026-09-21T10:00:00Z', ended_at: '2026-09-21T10:00:00Z', won: true, score: '2-1', rating_change: 5 }
    mockHub({
      [`/players/${ME}/team-history`]: env({ series: [{ ...t, series_id: 's1', mate: RTL_NAME, opponents: ['Ann', 'Bo'] }] }),
      [`/players/${ME}/team-stats`]: env({ rating: 1500, peak_rating: 1600, series_wins: 1, series_losses: 0, current_streak: 1 }),
      [`/players/${ME}/ffa-history`]: env({ games: [{ ...t, match_id: 'f1', placement: 1, player_count: 3, kills: 4, rounds_won: 5, points_total: 6, participants: ['Ann', RTL_NAME] }] }),
      [`/players/${ME}/ovt-history`]: env({ games: [{ ...t, match_id: 'o1', role: 'solo', solo: 'Ann', duo: [RTL_NAME, 'Bo'], gold_gained: 10 }] }),
    })
    renderApp(
      <>
        <TeamHistoryTab steamId={ME} />
        <FfaHistoryTab steamId={ME} />
        <OvtHistoryTab steamId={ME} />
      </>,
    )
    await waitFor(() => expect(screen.getAllByText(RTL_NAME)).toHaveLength(3))
    expect(screen.getAllByText(RTL_NAME).map((el) => el.tagName)).toEqual(['BDI', 'BDI', 'BDI'])
  })

  it('head-to-head heading and the identity panel\'s unpin button', async () => {
    const p = { ...(profile as unknown as HubProfile), display_name: RTL_NAME }
    mockHub({ [`/players/${p.steam_id}/vs/${SID}`]: env({ player_steam_id: p.steam_id, opponent_steam_id: SID, player_cards: [{ card_name: 'Echo', picks: 4, wins: 3 }], opponent_cards: [] }), '/me': SIGNED_OUT })
    renderApp(<HeadToHead p={p} me={SID} />)
    expect((await screen.findByRole('heading', { name: RTL_NAME })).querySelector('bdi')).not.toBeNull()

    writePinned({ steam_id: ME, display_name: RTL_NAME })
    renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: 'Identity options' }))
    expect(screen.getByRole('button', { name: /unpin/i }).querySelector('bdi')).not.toBeNull()
    localStorage.clear()
  })
})
