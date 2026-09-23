import type { Hono } from 'hono'
import type {
  ActiveSeriesList,
  ActiveTeamSeriesList,
  AlertsActive,
  FfaLobbies,
  MaintenanceStatus,
  MultimodeRecent,
  PresenceOnline,
  QueueCount,
  SpectateGames,
  TeamQueueCount,
} from '../../shared/api-types'
import type { HomeData } from '../../shared/hub-types'
import { TTL } from '../cache'
import { gather, gathered, loaderFor, type RouteDeps } from './common'

/** Everything the home page shows, from the same cache keys as /api/home. */
export async function loadHome(d: RouteDeps) {
  const load = loaderFor(d)
  const g = await gather(
    {
      presence: load<PresenceOnline>('home:presence', TTL.LIVE, '/presence/online'),
      queue: load<QueueCount>('home:queue', TTL.LIVE, '/queue/count'),
      team_queue: load<TeamQueueCount>('home:team-queue', TTL.LIVE, '/team/queue/count'),
      series_1v1: load<ActiveSeriesList>('home:series-1v1', TTL.LIVE, '/series/active'),
      series_2v2: load<ActiveTeamSeriesList>('home:series-2v2', TTL.LIVE, '/team/series/active'),
      ffa_lobbies: load<FfaLobbies>('home:ffa-lobbies', TTL.LIVE, '/ffa/lobbies'),
      spectate: load<SpectateGames>('home:spectate', TTL.LIVE, '/spectate/games'),
      results: load<MultimodeRecent>('results:20', TTL.RESULTS, '/series/recent-multimode', { limit: 20 }),
      maintenance: load<MaintenanceStatus>('home:maintenance', TTL.LIVE, '/admin/maintenance/status'),
      alerts: load<AlertsActive>('home:alerts', TTL.LIVE, '/alerts/active'),
    },
    d.now,
  )
  const v = g.values
  const data: HomeData = {
    presence: v.presence ?? { online_count: 0, online: [], recent: [] },
    queue: {
      ranked_searching: v.queue?.searching ?? 0,
      team_searching: v.team_queue?.searching ?? 0,
      online: v.queue?.online ?? v.presence?.online_count ?? 0,
    },
    live: {
      series_1v1: v.series_1v1?.series ?? [],
      series_2v2: v.series_2v2?.series ?? [],
      ffa_lobbies: v.ffa_lobbies?.lobbies ?? [],
      spectate: v.spectate?.games ?? [],
    },
    results: v.results?.entries ?? [],
    maintenance: v.maintenance?.in_maintenance ?? false,
    alerts: v.alerts?.alerts ?? [],
  }
  return { data, g }
}

export function registerHomeRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/home', async (c) => {
    const { data, g } = await loadHome(d)
    return gathered(c, g, data, 5)
  })
}
