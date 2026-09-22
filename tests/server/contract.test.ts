import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { CHECKS } from '../../scripts/contract-checks.mjs'
import { FIXTURE_DROPPED_KEYS, isDroppedFixtureKey } from '../../src/shared/fixture-privacy.mjs'

// The capture strips the private keys before a fixture is committed, so a fixture cannot
// prove they are still on the live API. `npm run contract` is what asserts that.
const SCRUBBED = FIXTURE_DROPPED_KEYS.map((k) => `missing ${k}`)
const live = (problems: string[]) => problems.filter((p) => !SCRUBBED.some((s) => p.endsWith(s)))

describe('contract checks against the captured fixtures', () => {
  for (const c of CHECKS) {
    const file = path.resolve('fixtures', `${c.fixture}.json`)
    const run = existsSync(file) ? it : it.skip
    run(`${c.path} matches the expected shape`, () => {
      const body = JSON.parse(readFileSync(file, 'utf8'))
      expect(live(c.check(body))).toEqual([])
    })
  }

  it('flags a broken leaderboard row', () => {
    const lb = CHECKS.find((c) => c.path.startsWith('/leaderboard'))!
    expect(live(lb.check({ entries: [{ rank: 1 }], total_players: 1 }))).not.toEqual([])
  })

  it('commits no private key in any fixture', () => {
    const offenders: string[] = []
    const walk = (v: unknown, where: string) => {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${where}[${i}]`))
      if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
          if (isDroppedFixtureKey(k)) offenders.push(`${where}.${k}`)
          walk(x, `${where}.${k}`)
        }
      }
    }
    for (const c of CHECKS) {
      const file = path.resolve('fixtures', `${c.fixture}.json`)
      if (existsSync(file)) walk(JSON.parse(readFileSync(file, 'utf8')), c.fixture)
    }
    expect(offenders).toEqual([])
  })
})
