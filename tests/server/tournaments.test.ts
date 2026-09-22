import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const CUR = (kind: string) => ({ tournament_id: `id-${kind}`, status: 'voting', kind, signups: [], matches: [], time_slot_options: [], time_slot_tallies: [], force_vote_count: 0, min_players: 8, max_players: 16 })

describe('tournaments', () => {
  it('returns both kinds from /tournaments/current', async () => {
    let n = 0
    const { app, fake } = makeApp({ '/tournaments/current': () => json(CUR(n++ === 0 ? 'sync' : 'async')) })
    const body = await (await app.request('/api/tournaments')).json()
    expect(body.data.sync.kind).toBe('sync')
    expect(body.data.async.kind).toBe('async')
    expect(fake.calls.map((c) => c.url.searchParams.get('kind')).sort()).toEqual(['async', 'sync'])
    expect(body.errors).toEqual([])
  })

  it('returns history rows and detail', async () => {
    const { app, fake } = makeApp({
      '/tournaments/history': [{ tournament_id: 'a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c', kind: 'async', winner_display_name: 'Sid' }],
      '/tournaments/history-detail': { tournaments: [{ tournament_id: 'a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c', participants: [] }] },
    })
    const body = await (await app.request('/api/tournaments/history')).json()
    expect(body.data.rows[0].winner_display_name).toBe('Sid')
    expect(body.data.detail[0].participants).toEqual([])
    expect(fake.calls.find((c) => c.url.pathname.endsWith('history-detail'))!.url.searchParams.get('limit')).toBe('8')
  })

  it('validates the bracket id as a UUID', async () => {
    const { app } = makeApp({ '/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket-detail': { matches: [{ match_id: 'm', games: [] }] } })
    const body = await (await app.request('/api/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket')).json()
    expect(body.data.matches[0].match_id).toBe('m')
    expect((await app.request('/api/tournaments/not-a-uuid/bracket')).status).toBe(400)
  })
})
