import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate, signed } from '../../lib/format'

export function TeamHistoryTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'team-history')
  const stats = usePlayerSub(steamId, 'team-stats')
  return (
    <div className="card">
      {stats.data ? (
        <div className="muted" style={{ marginBottom: 8 }}>
          2v2 rating {Math.round(stats.data.data.rating)} · peak {Math.round(stats.data.data.peak_rating)} · series {stats.data.data.series_wins}-{stats.data.data.series_losses} · streak {signed(stats.data.data.current_streak)}
        </div>
      ) : null}
      <QueryState q={q} label="2v2 series" empty={(d) => !d.series?.length} emptyHint="No 2v2 series yet.">
        {(d) => (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Result</th>
                  <th>With</th>
                  <th>Against</th>
                  <th className="num">Rating</th>
                </tr>
              </thead>
              <tbody>
                {d.series.map((s) => (
                  <tr key={s.series_id}>
                    <td className="faint">{fmtDate(s.completed_at)}</td>
                    <td>
                      <strong className={s.won ? 'good' : 'bad'}>{s.won ? 'W' : 'L'}</strong> <span className="mono">{s.score}</span>
                    </td>
                    <td>{s.mate}</td>
                    <td>{(s.opponents ?? []).join(' & ')}</td>
                    <td className={`num mono ${s.rating_change >= 0 ? 'good' : 'bad'}`}>{signed(s.rating_change, 1)}</td>
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
