import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate } from '../../lib/format'
import { Names } from '../../components/Names'

export function OvtHistoryTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'ovt-history')
  return (
    <div className="card">
      <QueryState q={q} label="1v2 games" empty={(d) => !d.games?.length} emptyHint="No 1v2 games yet.">
        {(d) => (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Role</th>
                  <th>Result</th>
                  <th>Solo</th>
                  <th>Duo</th>
                  <th className="num">Gold</th>
                </tr>
              </thead>
              <tbody>
                {d.games.map((g) => (
                  <tr key={g.match_id}>
                    <td className="faint">{fmtDate(g.ended_at)}</td>
                    <td>{g.role}</td>
                    <td>
                      <strong className={g.won ? 'good' : 'bad'}>{g.won ? 'W' : 'L'}</strong> <span className="tnum">{g.score}</span>
                    </td>
                    <td>
                      <bdi>{g.solo}</bdi>
                    </td>
                    <td>
                      <Names names={g.duo} sep=" & " />
                    </td>
                    <td className="num">+{g.gold_gained}g</td>
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
