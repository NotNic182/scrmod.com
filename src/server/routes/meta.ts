import type { Hono } from 'hono'
import type { AchievementDefinitions, RankTiersResponse, ReleasesRecent } from '../../shared/api-types'
import type { MetaData } from '../../shared/hub-types'
import { TTL } from '../cache'
import { gather, loaderFor, type RouteDeps } from './common'

export function registerMetaRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/meta', async (c) => {
    const load = loaderFor(d, c)
    const g = await gather({
      rank_tiers: load<RankTiersResponse>('meta:tiers', TTL.REF, '/rank-tiers'),
      achievement_definitions: load<AchievementDefinitions>('meta:achdefs', TTL.REF, '/achievements/definitions'),
      releases: load<ReleasesRecent>('meta:releases', TTL.REF, '/releases/recent', { limit: 3 }),
    })
    const state = d.version.state()
    const data: MetaData = {
      rank_tiers: g.values.rank_tiers?.tiers ?? [],
      achievement_definitions: g.values.achievement_definitions?.achievements ?? {},
      mod_version: state.version ? { version: state.version, min_version: state.version } : null,
      releases: g.values.releases?.posts ?? [],
    }
    c.header('Cache-Control', 'public, max-age=60')
    return c.json({ data, fetched_at: new Date(g.fetched_at).toISOString(), stale: g.stale, errors: g.errors })
  })
}
