import { useVs } from '../../api/hooks'
import type { HubProfile } from '../../api/types'
import { QueryState } from '../../components/QueryState'
import { StatTile } from '../../components/StatTile'
import { pct } from '../../lib/format'

/** Head-to-head between the viewed player `p` and the viewer `me` (h2h_* fields are p's perspective). */
export function HeadToHead({ p, me }: { p: HubProfile; me: string }) {
  const vs = useVs(p.steam_id, me)
  return (
    <>
      <div className="tiles">
        <StatTile label="Ranked series" value={`${p.h2h_series_wins ?? 0}-${p.h2h_series_losses ?? 0}`} sub={`${p.display_name} vs you`} />
        <StatTile label="Ranked games" value={`${p.h2h_ranked_wins ?? 0}-${p.h2h_ranked_losses ?? 0}`} />
      </div>
      <div className="card">
        <h2>Most picked against each other</h2>
        <QueryState q={vs} label="head-to-head cards" empty={(d) => !d.player_cards?.length && !d.opponent_cards?.length}>
          {(d) => (
            <div className="grid-2">
              <div>
                <h3>
                  <bdi className="player-name">{p.display_name}</bdi>
                </h3>
                <CardRows rows={d.player_cards} />
              </div>
              <div>
                <h3>You</h3>
                <CardRows rows={d.opponent_cards} />
              </div>
            </div>
          )}
        </QueryState>
      </div>
    </>
  )
}

function CardRows({ rows }: { rows: Array<{ card_name: string; picks: number; wins: number }> | undefined }) {
  if (!rows?.length) return <div className="empty">No picks against each other yet.</div>
  return (
    <div className="table-wrap inset">
      <table className="t">
        <thead>
          <tr>
            <th>Card</th>
            <th className="num">Picks</th>
            <th className="num">Win %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.card_name}>
              <td>{r.card_name}</td>
              <td className="num">{r.picks}×</td>
              <td className="num">{pct(r.picks ? r.wins / r.picks : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
