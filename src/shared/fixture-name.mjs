// Shared fixture naming rule (spec 7.4). Used by both the runtime fixture fetch
// (src/server/fixtures.ts) and the capture script (scripts/capture-fixtures.mjs) so a
// captured file name can never drift from what the runtime looks up.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * @param {string} urlPath
 * @returns {string}
 */
export function fixtureNameFor(urlPath) {
  const p = urlPath.replace(/^\/api\/v1\//, '').replace(/^\/+|\/+$/g, '')
  return p
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) ? 'ID' : UUID_RE.test(seg) ? 'UUID' : seg))
    .join('__')
}
