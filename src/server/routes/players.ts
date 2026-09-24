import type { Context, Hono } from 'hono'
import { KEEP_FOR_PROFILE_MASK, isRankedMatch, maskProfile, rankedSummary, scrubPrivate, slimMatch } from '../../shared/privacy'
import { TTL, type CachedResult, type TtlSpec } from '../cache'
import type { Query } from '../upstream'
import { errorResponse, intParam, isSteamId, loaderFor, ok, type RouteDeps } from './common'

interface SubSpec {
  path: (id: string) => string
  query?: (c: Context) => Query
  spec: TtlSpec
  transform?: (v: unknown) => unknown
}

/** Fixed page sizes, so `limit` is not a free dimension an anonymous visitor can enumerate. */
const MATCH_LIMITS = [50, 100, 200]
const MAX_MATCH_OFFSET = 2000

function quantizeLimit(n: number): number {
  return MATCH_LIMITS.find((l) => n <= l) ?? MATCH_LIMITS[MATCH_LIMITS.length - 1]
}

const SUB: Record<string, SubSpec> = {
  matches: {
    path: (id) => `/players/${id}/matches`,
    query: (c) => ({
      limit: quantizeLimit(intParam(c, 'limit', 100, 1, 200)),
      offset: intParam(c, 'offset', 0, 0, MAX_MATCH_OFFSET),
    }),
    spec: TTL.PLAYER,
    // Ranked games only: casual games stay off profiles.
    transform: (v) =>
      Array.isArray(v) ? v.filter((m) => isRankedMatch(m as object)).map((m) => slimMatch(m as Record<string, unknown>)) : [],
  },
  'matches-summary': {
    path: (id) => `/players/${id}/matches/summary`,
    spec: TTL.PLAYER,
    transform: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? rankedSummary(v) : v),
  },
  'rating-history': { path: (id) => `/players/${id}/rating-history`, spec: TTL.PLAYER },
  'team-history': { path: (id) => `/players/${id}/team-history`, spec: TTL.PLAYER },
  'ffa-history': { path: (id) => `/players/${id}/ffa-history`, spec: TTL.PLAYER },
  'ovt-history': { path: (id) => `/players/${id}/ovt-history`, spec: TTL.PLAYER },
  'team-stats': { path: (id) => `/team/players/${id}/team-stats`, spec: TTL.PLAYER },
  achievements: { path: (id) => `/achievements/${id}`, spec: TTL.PLAYER },
  tournaments: { path: (id) => `/tournaments/players/${id}/tournaments`, spec: TTL.PLAYER },
}

/** A profile with the privacy masks applied, under the same cache key the /api/players/:id route uses. */
export async function loadProfile(d: RouteDeps, id: string, viewer?: string): Promise<CachedResult<Record<string, unknown>>> {
  // The cache holds the profile with the discord fields already gone; `hide_gold` is
  // held back so `maskProfile` can still turn it into `gold_hidden` on the way out.
  const r = await loaderFor(d)<Record<string, unknown>>(
    `player:${id}:${viewer ?? ''}`,
    TTL.PLAYER,
    `/players/${id}`,
    { viewer_steam_id: viewer },
    (raw) => scrubPrivate(raw as Record<string, unknown>, KEEP_FOR_PROFILE_MASK),
  )
  return { ...r, value: maskProfile(r.value) }
}

export function registerPlayerRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/players/:id', async (c) => {
    const id = c.req.param('id')
    if (!isSteamId(id)) return c.json({ error: 'bad_steam_id' }, 400)
    const me = c.req.query('me')
    const viewer = isSteamId(me) && me !== id ? me : undefined
    try {
      return ok(c, await loadProfile(d, id, viewer))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/:id/vs/:opp', async (c) => {
    const id = c.req.param('id')
    const opp = c.req.param('opp')
    if (!isSteamId(id) || !isSteamId(opp)) return c.json({ error: 'bad_steam_id' }, 400)
    try {
      return ok(c, await loaderFor(d)(`vs:${id}:${opp}`, TTL.PLAYER, `/players/${id}/vs/${opp}/top-cards`))
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/:id/:sub', async (c) => {
    const id = c.req.param('id')
    const sub = c.req.param('sub')
    if (!isSteamId(id)) return c.json({ error: 'bad_steam_id' }, 400)
    const spec = Object.hasOwn(SUB, sub) ? SUB[sub] : undefined
    if (!spec) return c.json({ error: 'not_found' }, 404)
    const query = spec.query?.(c)
    const key = `player:${id}:${sub}:${JSON.stringify(query ?? {})}`
    try {
      return ok(c, await loaderFor(d)<unknown>(key, spec.spec, spec.path(id), query, spec.transform))
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
