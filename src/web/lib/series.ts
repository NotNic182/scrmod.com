import type { PlayerMatch } from '../../shared/api-types'

export interface SeriesGroup {
  key: string
  series_id: string | null
  ranked: boolean
  opponent_steam_id: string
  opponent_name: string
  opponent_title: string
  opponent_title_color: string
  score: string | null
  rating_change: number | null
  ended_at: string
  games: PlayerMatch[]
}

/** Upstream returns newest first. Consecutive rows with the same series_id are one series. */
export function groupSeries(matches: PlayerMatch[]): SeriesGroup[] {
  const out: SeriesGroup[] = []
  for (const m of matches) {
    const last = out[out.length - 1]
    if (m.series_id && last && last.series_id === m.series_id) {
      last.games.push(m)
      continue
    }
    out.push({
      key: m.series_id ?? m.match_id,
      series_id: m.series_id ?? null,
      ranked: !!m.is_ranked,
      opponent_steam_id: m.opponent_steam_id,
      opponent_name: m.opponent_name,
      opponent_title: m.opponent_title,
      opponent_title_color: m.opponent_title_color,
      score: m.series_score ?? null,
      rating_change: m.series_rating_change ?? null,
      ended_at: m.ended_at,
      games: [m],
    })
  }
  return out
}
