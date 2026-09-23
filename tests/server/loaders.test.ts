import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { loadCardLeaders, loadCards } from '../../src/server/routes/cards'
import { loadBoard, loadResults } from '../../src/server/routes/boards'
import { loadHome } from '../../src/server/routes/home'
import { loadBracket, loadTournamentHistory, loadTournaments } from '../../src/server/routes/tournaments'
import { loadProfile } from '../../src/server/routes/players'

const ID = '76561199311926326'
const UUID = '0b7c0a6e-1f2d-4c5e-9a8b-7c6d5e4f3a2b'
const hits = (calls: Array<{ url: URL }>, path: string) => calls.filter((c) => c.url.pathname === `/api/v1${path}`).length

describe('named loaders share the API routes cache entries', () => {
  it('cards, card leaders, a board and results', async () => {
    const { app, deps, fake } = makeApp({
      '/cards': [{ card_name: 'Poison', card_rarity: 'Common', times_picked: 10, win_rate: 0.5, pass_rate: 0.3 }],
      '/cards/leaders-summary': { sweepers: ['Poison|Stan|3'], winners: [] },
      '/leaderboard': { entries: [], total_players: 0 },
      '/series/recent-multimode': { entries: [] },
    })
    expect((await loadCards(deps, 'all')).value[0].card_name).toBe('Poison')
    expect((await loadCardLeaders(deps)).value.sweepers).toEqual([{ card: 'Poison', player: 'Stan', count: 3 }])
    expect((await loadBoard(deps, '1v1'))?.value).toEqual({ entries: [], total_players: 0 })
    await loadResults(deps, 100)
    await app.request('/api/cards')
    await app.request('/api/cards/leaders')
    await app.request('/api/leaderboard/1v1')
    await app.request('/api/results?limit=100')
    expect(hits(fake.calls, '/cards')).toBe(1)
    expect(hits(fake.calls, '/cards/leaders-summary')).toBe(1)
    expect(hits(fake.calls, '/leaderboard')).toBe(1)
    expect(hits(fake.calls, '/series/recent-multimode')).toBe(1)
    expect(await loadBoard(deps, 'nope')).toBeNull()
  })

  it('home, tournaments, history, a bracket and a profile', async () => {
    const { app, deps, fake } = makeApp({
      '/presence/online': { online_count: 2, online: [], recent: [] },
      '/tournaments/current': { tournament_id: null },
      '/tournaments/history': [],
      '/tournaments/history-detail': { tournaments: [] },
      [`/tournaments/${UUID}/bracket-detail`]: { matches: [] },
      [`/players/${ID}`]: { steam_id: ID, display_name: 'NotNic', hide_gold: true, gold_earned: 5 },
    })
    expect((await loadHome(deps)).data.presence.online_count).toBe(2)
    await loadTournaments(deps)
    await loadTournamentHistory(deps)
    await loadBracket(deps, UUID)
    expect((await loadProfile(deps, ID)).value.gold_hidden).toBe(true)
    await app.request('/api/home')
    await app.request('/api/tournaments')
    await app.request('/api/tournaments/history')
    await app.request(`/api/tournaments/${UUID}/bracket`)
    await app.request(`/api/players/${ID}`)
    expect(hits(fake.calls, '/presence/online')).toBe(1)
    expect(hits(fake.calls, '/tournaments/current')).toBe(2) // sync and async are two keys
    expect(hits(fake.calls, '/tournaments/history')).toBe(1)
    expect(hits(fake.calls, `/tournaments/${UUID}/bracket-detail`)).toBe(1)
    expect(hits(fake.calls, `/players/${ID}`)).toBe(1)
  })
})
