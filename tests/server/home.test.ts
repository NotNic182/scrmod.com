import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const PRESENCE = {
  online_count: 2,
  online: [{ display_name: 'Spirit', steam_id: '76561198984811435', rating: 1868, title: 'Clown', title_color: '#FF6688', minutes_ago: 0 }],
  recent: [{ display_name: 'NotNic', steam_id: '76561199311926326', rating: 1101, title: 'Poisoner', title_color: '#66CC44', minutes_ago: 13 }],
}
const SERIES = {
  series: [{
    series_id: 's1', p1_steam_id: '76561199311926326', p1_name: 'NotNic', p1_rating: 1101, p1_rd: 66, p1_wins: 1, p1_odds: 2.1, p1_bettable: true,
    p2_steam_id: '76561198040410653', p2_name: 'Sid', p2_rating: 2564, p2_rd: 127, p2_wins: 0, p2_odds: 1.05, p2_bettable: false,
    live_p1_points: 1, live_p2_points: 0, bets_locked: true, lock_reason: 'game_in_progress', is_private: false, is_tournament: false,
    tournament_kind: null, tournament_label: '', phase: 'live', started_at: '2026-09-22T10:00:00Z',
  }],
}
const RESULTS = { entries: [{ mode: 'ffa', id: 'm1', ended_at: '2026-09-22T08:25:02Z', left_label: 'Nix', right_label: '3-player FFA', score: '#1 of 3', left_rating_change: 6.7, right_rating_change: null, settings: null, bets: [] }] }

const ALL = {
  '/presence/online': PRESENCE,
  '/queue/count': { searching: 1, total: 1, online: 7 },
  '/team/queue/count': { searching: 4 },
  '/series/active': SERIES,
  '/team/series/active': { series: [{ series_id: 't1', t1a_name: 'A', t1b_name: 'B', t2a_name: 'C', t2b_name: 'D', t1_wins: 1, t2_wins: 0 }] },
  '/ffa/lobbies': { lobbies: [{ lobby_id: 'l1', host_name: 'Nix', player_count: 3, max_players: 10, has_password: false, age_seconds: 40, bets_open: true, bet_targets: [], members: [] }], count: 1 },
  '/spectate/games': { games: [{ game_id: 'g1', mode: '1v1', names: 'NotNic, Sid', spectatable: true, spectator_count: 0, spectator_cap: 4 }] },
  '/series/recent-multimode': RESULTS,
  '/admin/maintenance/status': { in_maintenance: true },
  '/alerts/active': { rev: 1, alerts: [{ category: 'info', message: 'Server restart at 9pm', expires_at: null }] },
}

describe('GET /api/home', () => {
  it('aggregates every live item into HomeData', async () => {
    const { app, fake } = makeApp(ALL)
    const res = await app.request('/api/home')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toEqual([])
    expect(body.data.presence.online[0].display_name).toBe('Spirit')
    expect(body.data.queue).toEqual({ ranked_searching: 1, team_searching: 4, online: 7 })
    expect(body.data.live.series_1v1[0].p1_name).toBe('NotNic')
    expect(body.data.live.series_2v2[0].series_id).toBe('t1')
    expect(body.data.live.ffa_lobbies[0].host_name).toBe('Nix')
    expect(body.data.live.spectate[0].game_id).toBe('g1')
    expect(body.data.results[0].score).toBe('#1 of 3')
    expect(body.data.maintenance).toBe(true)
    expect(body.data.alerts[0].message).toBe('Server restart at 9pm')
    const upstreamPaths = fake.calls.map((c) => c.url.pathname).sort()
    expect(upstreamPaths).toContain('/api/v1/series/recent-multimode')
    expect(fake.calls.find((c) => c.url.pathname === '/api/v1/series/recent-multimode')!.url.searchParams.get('limit')).toBe('20')
  })

  it('serves the second request from cache without touching upstream', async () => {
    const { app, fake } = makeApp(ALL)
    await app.request('/api/home')
    const n = fake.calls.length
    await app.request('/api/home')
    expect(fake.calls.length).toBe(n)
  })

  it('degrades: a failing item becomes an empty default and is named in errors', async () => {
    const { app } = makeApp({ ...ALL, '/series/active': () => json({ detail: 'boom' }, 500) })
    const body = await (await app.request('/api/home')).json()
    expect(body.data.live.series_1v1).toEqual([])
    expect(body.errors).toEqual(['series_1v1'])
    expect(body.data.presence.online_count).toBe(2)
  })

  it('falls back to the presence count when queue/count fails', async () => {
    const { app } = makeApp({ ...ALL, '/queue/count': () => json({ detail: 'down' }, 500) })
    const body = await (await app.request('/api/home')).json()
    expect(body.data.queue.online).toBe(PRESENCE.online_count)
    expect(body.data.queue.ranked_searching).toBe(0)
    expect(body.errors).toEqual(['queue'])
  })
})
