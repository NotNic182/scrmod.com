// Hits the live API once per dependency and validates the shape. Manual, on demand (spec 10).
import { CHECKS } from './contract-checks.mjs'

const BASE = (process.env.SCR_UPSTREAM_BASE || 'https://competitive-rounds.duckdns.org:8444').replace(/\/+$/, '')
const UA = 'scr-hub-contract/0.1'

async function main() {
  const mv = await (await fetch(`${BASE}/api/v1/mod-version`, { headers: { 'User-Agent': UA } })).json()
  const version = process.env.SCR_MOD_VERSION || mv.version
  let failures = 0
  for (const c of CHECKS) {
    let problems
    try {
      const res = await fetch(`${BASE}/api/v1${c.path}`, {
        headers: { 'User-Agent': UA, 'X-Mod-Version': version, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      problems = res.status === 200 ? c.check(await res.json()) : [`HTTP ${res.status}`]
    } catch (e) {
      problems = [String(e)]
    }
    if (problems.length) failures++
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${c.path}${problems.length ? '  -> ' + problems.join('; ') : ''}`)
    await new Promise((r) => setTimeout(r, 150))
  }
  console.log(`\n${CHECKS.length - failures}/${CHECKS.length} passed (mod version ${version})`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
