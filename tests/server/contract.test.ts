import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { CHECKS } from '../../scripts/contract-checks.mjs'

describe('contract checks against the captured fixtures', () => {
  for (const c of CHECKS) {
    const file = path.resolve('fixtures', `${c.fixture}.json`)
    const run = existsSync(file) ? it : it.skip
    run(`${c.path} matches the expected shape`, () => {
      const body = JSON.parse(readFileSync(file, 'utf8'))
      expect(c.check(body)).toEqual([])
    })
  }

  it('flags a broken leaderboard row', () => {
    const lb = CHECKS.find((c) => c.path.startsWith('/leaderboard'))!
    expect(lb.check({ entries: [{ rank: 1 }], total_players: 1 })).not.toEqual([])
  })
})
