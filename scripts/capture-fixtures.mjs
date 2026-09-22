// Capture upstream responses into fixtures/ for demo and test mode (spec 7.4).
// Usage: npm run capture            (uses NotNic + Sid as the sample players)
//        SCR_UPSTREAM_BASE=... SCR_MOD_VERSION=... npm run capture
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixtureNameFor } from '../src/shared/fixture-name.mjs'

const BASE = (process.env.SCR_UPSTREAM_BASE || 'https://competitive-rounds.duckdns.org:8444').replace(/\/+$/, '')
const UA = 'scr-hub-capture/0.1 (+https://github.com/NotNic/scr-hub)'
const ME = process.env.SCR_SAMPLE_STEAM_ID || '76561199311926326'
const OPP = process.env.SCR_SAMPLE_OPPONENT_ID || '76561198040410653'
const OUT = path.resolve('fixtures')

async function modVersion() {
  if (process.env.SCR_MOD_VERSION) return process.env.SCR_MOD_VERSION
  const r = await fetch(`${BASE}/api/v1/mod-version`, { headers: { 'User-Agent': UA } })
  const j = await r.json()
  return j.version
}

const DROP_KEYS = /^(p1_|p2_)?discord_id$|^discord_username$/
function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub)
  if (v && typeof v === 'object') {
    const o = {}
    for (const [k, x] of Object.entries(v)) {
      if (DROP_KEYS.test(k)) continue
      o[k] = scrub(x)
    }
    return o
  }
  return v
}

const STATIC = [
  '/mod-version', '/health', '/admin/maintenance/status', '/alerts/active', '/rank-tiers',
  '/leaderboard?limit=500', '/team/leaderboard?limit=500', '/ffa/leaderboard?limit=500', '/ovt/leaderboard?limit=500',
  '/presence/online', '/queue/count', '/team/queue/count', '/queue/recent-joins?seconds=3600',
  '/series/active', '/team/series/active', '/ffa/lobbies', '/spectate/games',
  '/series/recent?minutes=43200&limit=50', '/series/recent-multimode?limit=60',
  '/players/search?q=nic',
  `/players/${ME}?viewer_steam_id=${OPP}`, `/players/${ME}/matches?limit=100`, `/players/${ME}/matches/summary`,
  `/players/${ME}/rating-history`, `/players/${ME}/team-history`, `/players/${ME}/ffa-history`, `/players/${ME}/ovt-history`,
  `/players/${ME}/vs/${OPP}/top-cards`, `/team/players/${ME}/team-stats`,
  '/achievements/definitions', `/achievements/${ME}`,
  '/cards?limit=200&min_picks=5', '/cards/leaders-summary?limit_per_card=5', '/cards/top-pickers?card_name=Poison',
  '/tournaments/current?kind=sync', '/tournaments/history', '/tournaments/history-detail?limit=8',
  `/tournaments/players/${ME}/tournaments`,
  '/chat/recent?limit=50', '/releases/recent?limit=3',
]

async function get(version, p) {
  const r = await fetch(`${BASE}/api/v1${p}`, {
    headers: { 'User-Agent': UA, 'X-Mod-Version': version, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text } }
  return { status: r.status, body }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const version = await modVersion()
  const paths = [...STATIC]
  // Bracket detail needs a real tournament id: take the newest completed one.
  const hist = await get(version, '/tournaments/history')
  if (hist.status === 200 && Array.isArray(hist.body) && hist.body[0]) {
    paths.push(`/tournaments/${hist.body[0].tournament_id}/bracket-detail`)
  }
  let ok = 0
  for (const p of paths) {
    const { status, body } = await get(version, p)
    const file = path.join(OUT, `${fixtureNameFor(p.split('?')[0])}.json`)
    if (status !== 200) {
      console.log(`skip ${p} -> ${status}`)
      continue
    }
    await writeFile(file, JSON.stringify(scrub(body), null, 2) + '\n')
    ok++
    console.log(`ok   ${p} -> ${path.basename(file)}`)
    await new Promise((r) => setTimeout(r, 150))
  }
  console.log(`\n${ok}/${paths.length} fixtures written to ${OUT} (mod version ${version})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
