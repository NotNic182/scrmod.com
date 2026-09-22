import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fixtureNameFor, createFixtureFetch } from '../../src/server/fixtures'

describe('fixtureNameFor', () => {
  it('normalises ids and joins segments', () => {
    expect(fixtureNameFor('/api/v1/leaderboard')).toBe('leaderboard')
    expect(fixtureNameFor('/api/v1/players/76561199311926326/matches')).toBe('players__ID__matches')
    expect(fixtureNameFor('/players/76561199311926326/matches')).toBe('players__ID__matches')
    expect(fixtureNameFor('/api/v1/players/76561199311926326/vs/76561198040410653/top-cards')).toBe(
      'players__ID__vs__ID__top-cards',
    )
    expect(fixtureNameFor('/api/v1/players/by-discord/1299197810780143656')).toBe('players__by-discord__ID')
    expect(fixtureNameFor('/api/v1/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket-detail')).toBe(
      'tournaments__UUID__bracket-detail',
    )
    expect(fixtureNameFor('/api/v1/admin/maintenance/status')).toBe('admin__maintenance__status')
  })
})

describe('createFixtureFetch', () => {
  it('serves the JSON file for a known path and 404 for an unknown one', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scr-fixtures-'))
    await writeFile(path.join(dir, 'queue__count.json'), JSON.stringify({ searching: 3, total: 3, online: 9 }))
    const f = createFixtureFetch(dir)
    const ok = await f('https://up.test/api/v1/queue/count?steam_id=1')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ searching: 3, total: 3, online: 9 })
    const missing = await f('https://up.test/api/v1/series/active')
    expect(missing.status).toBe(404)
  })
})
