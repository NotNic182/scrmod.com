import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const TIERS = { tiers: [{ floor: 2330, name: 'Grand Master', color: '#F487A9' }, { floor: 0, name: 'Beginner', color: '#BB79EE' }] }
const DEFS = { achievements: { untouchable: { name: 'Untouchable', desc: 'Win 5-0' } } }
const RELEASES = { posts: [{ author: 'Competitive ROUNDS', content: 'v1.40.3', posted_at: '2026-09-09T00:00:00Z' }] }

describe('GET /api/meta', () => {
  it('aggregates tiers, achievement definitions, releases and the version state', async () => {
    const { app } = makeApp({ '/rank-tiers': TIERS, '/achievements/definitions': DEFS, '/releases/recent': RELEASES })
    const res = await app.request('/api/meta')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.rank_tiers).toEqual(TIERS.tiers)
    expect(body.data.achievement_definitions.untouchable.name).toBe('Untouchable')
    expect(body.data.releases[0].content).toBe('v1.40.3')
    expect(body.data.mod_version).toEqual({ version: '1.40.3', min_version: '1.40.3' })
    expect(body.errors).toEqual([])
    expect(typeof body.fetched_at).toBe('string')
    expect(body.stale).toBe(false)
  })

  it('returns what it can when one upstream item fails, naming it in errors', async () => {
    const { app } = makeApp({ '/rank-tiers': TIERS, '/achievements/definitions': () => json({}, 500), '/releases/recent': RELEASES })
    const body = await (await app.request('/api/meta')).json()
    expect(body.data.rank_tiers.length).toBe(2)
    expect(body.data.achievement_definitions).toEqual({})
    expect(body.errors).toEqual(['achievement_definitions'])
  })
})
