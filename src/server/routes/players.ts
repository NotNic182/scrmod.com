import type { Context, Hono } from 'hono'
import { maskProfile, slimMatch } from '../../shared/privacy'
import { TTL, type TtlSpec } from '../cache'
import type { Query } from '../upstream'
import { errorResponse, intParam, isSteamId, loaderFor, ok, type RouteDeps } from './common'

interface SubSpec {
  path: (id: string) => string
  query?: (c: Context) => Query
  spec: TtlSpec
  transform?: (v: unknown) => unknown
}

const SUB: Record<string, SubSpec> = {
  matches: {
    path: (id) => `/players/${id}/matches`,
    query: (c) => ({ limit: intParam(c, 'limit', 100, 1, 200), offset: intParam(c, 'offset', 0, 0, 100_000) }),
    spec: TTL.PLAYER,
    transform: (v) => (Array.isArray(v) ? v.map((m) => slimMatch(m as Record<string, unknown>)) : []),
  },
  'matches-summary': { path: (id) => `/players/${id}/matches/summary`, spec: TTL.PLAYER },
  'rating-history': { path: (id) => `/players/${id}/rating-history`, spec: TTL.PLAYER },
  'team-history': { path: (id) => `/players/${id}/team-history`, spec: TTL.PLAYER },
  'ffa-history': { path: (id) => `/players/${id}/ffa-history`, spec: TTL.PLAYER },
  'ovt-history': { path: (id) => `/players/${id}/ovt-history`, spec: TTL.PLAYER },
  'team-stats': { path: (id) => `/team/players/${id}/team-stats`, spec: TTL.PLAYER },
  achievements: { path: (id) => `/achievements/${id}`, spec: TTL.PLAYER },
  tournaments: { path: (id) => `/tournaments/players/${id}/tournaments`, spec: TTL.PLAYER },
}

export function registerPlayerRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/players/:id', async (c) => {
    const id = c.req.param('id')
    if (!isSteamId(id)) return c.json({ error: 'bad_steam_id' }, 400)
    const me = c.req.query('me')
    const viewer = isSteamId(me) && me !== id ? me : undefined
    try {
      const r = await loaderFor(d, c)<Record<string, unknown>>(
        `player:${id}:${viewer ?? ''}`,
        TTL.PLAYER,
        `/players/${id}`,
        { viewer_steam_id: viewer },
      )
      return ok(c, { ...r, value: maskProfile(r.value) })
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  app.get('/api/players/:id/vs/:opp', async (c) => {
    const id = c.req.param('id')
    const opp = c.req.param('opp')
    if (!isSteamId(id) || !isSteamId(opp)) return c.json({ error: 'bad_steam_id' }, 400)
    try {
      return ok(c, await loaderFor(d, c)(`vs:${id}:${opp}`, TTL.PLAYER, `/players/${id}/vs/${opp}/top-cards`))
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
      const r = await loaderFor(d, c)<unknown>(key, spec.spec, spec.path(id), query)
      return ok(c, spec.transform ? { ...r, value: spec.transform(r.value) } : r)
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
