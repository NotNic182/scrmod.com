// Private keys the fixture capture strips out (spec 12). `fixtures/` is committed, so a
// captured demo body must never carry a real player's discord identity or their privacy
// settings. Sid's live API still sends these — the hub needs `hide_gold` to compute
// `gold_hidden` — so the live contract check keeps asserting them; only the fixture-backed
// run of the same checks ignores exactly these keys.

export const FIXTURE_DROPPED_KEYS = [
  'discord_id',
  'discord_username',
  'p1_discord_id',
  'p2_discord_id',
  'hide_gold',
  'appear_offline',
]

const DROP_RE = new RegExp(`^(${FIXTURE_DROPPED_KEYS.join('|')})$`)

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isDroppedFixtureKey(key) {
  return DROP_RE.test(key)
}

/**
 * Recursively removes the private keys from a captured body.
 * @param {unknown} value
 * @returns {unknown}
 */
export function scrubFixture(value) {
  if (Array.isArray(value)) return value.map(scrubFixture)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (isDroppedFixtureKey(k)) continue
      out[k] = scrubFixture(v)
    }
    return out
  }
  return value
}
