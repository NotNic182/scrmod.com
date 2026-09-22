import type { Hono } from 'hono'
import type { AchievementDefinitions, RankTiersResponse, ReleasesRecent } from '../../shared/api-types'
import type { MetaData } from '../../shared/hub-types'
import { FALLBACK_TIERS } from '../../shared/rank'
import { TTL } from '../cache'
import { gather, gathered, loaderFor, type RouteDeps } from './common'

export function registerMetaRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/meta', async (c) => {
    const load = loaderFor(d)
    const g = await gather(
      {
        rank_tiers: load<RankTiersResponse>('meta:tiers', TTL.REF, '/rank-tiers'),
        achievement_definitions: load<AchievementDefinitions>('meta:achdefs', TTL.REF, '/achievements/definitions'),
        releases: load<ReleasesRecent>('meta:releases', TTL.REF, '/releases/recent', { limit: 3 }),
      },
      d.now,
    )
    const state = d.version.state()
    const tiers = g.values.rank_tiers?.tiers
    const data: MetaData = {
      // Never hand the frontend an empty tier list: it would have no rank names to render.
      rank_tiers: tiers?.length ? tiers : FALLBACK_TIERS,
      achievement_definitions: g.values.achievement_definitions?.achievements ?? {},
      mod_version: state.version ? { version: state.version, min_version: state.min_version ?? state.version } : null,
      releases: g.values.releases?.posts ?? [],
    }
    return gathered(c, g, data, 60)
  })
}
