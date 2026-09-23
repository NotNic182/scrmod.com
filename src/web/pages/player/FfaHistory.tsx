import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate, signed } from '../../lib/format'

export function FfaHistoryTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'ffa-history')
  return (
    <div className="card">
      <QueryState q={q} label="FFA games" empty={(d) => !d.games?.length} emptyHint="No FFA games yet.">
        {(d) => (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Place</th>
                  <th className="num">Kills</th>
                  <th className="num">Rounds</th>
                  <th className="num">Points</th>
                  <th className="num">Rating</th>
                  <th>Lobby</th>
                </tr>
              </thead>
              <tbody>
                {d.games.map((g) => (
                  <tr key={g.match_id}>
                    <td className="faint">{fmtDate(g.ended_at)}</td>
                    <td>
                      <strong className={g.placement === 1 ? 'good' : ''}>#{g.placement}</strong>
                      <span className="faint"> of {g.player_count}</span>
                    </td>
                    <td className="num">{g.kills}</td>
                    <td className="num">{g.rounds_won}</td>
                    <td className="num">{g.points_total}</td>
                    <td className={`num tnum ${g.rating_change >= 0 ? 'good' : 'bad'}`}>{signed(g.rating_change, 1)}</td>
                    <td className="faint">{(g.participants ?? []).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </div>
  )
}
