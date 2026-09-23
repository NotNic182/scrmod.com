import { Link } from 'react-router'
import { useTournamentHistory } from '../../api/hooks'
import { PlayerLink } from '../../components/PlayerLink'
import { QueryState } from '../../components/QueryState'
import { fmtDate, plural } from '../../lib/format'
import { Icon } from '../../components/Icon'

export function History() {
  const q = useTournamentHistory()
  return (
    <div className="card">
      <h2>Past tournaments</h2>
      <QueryState q={q} label="tournament history" empty={(d) => !d.rows?.length}>
        {(d) => (
          <>
            {d.rows.map((r) => {
              const detail = d.detail.find((x) => x.tournament_id === r.tournament_id)
              return (
                <details key={r.tournament_id} className="acc">
                  <summary className="row">
                    <span className="chip">{r.kind}</span>
                    <span className="faint">{r.format.replace(/_/g, ' ')}</span>
                    <span className="spacer" />
                    <span className="row" style={{ gap: 6 }}>
                      <Icon name="trophy" size={16} />
                      <span className="sr-only">Winner:</span>
                      <strong>
                        <bdi>{r.winner_display_name ?? '–'}</bdi>
                      </strong>
                    </span>
                    <span className="faint">{fmtDate(r.ended_at)}</span>
                  </summary>
                  {r.winner_steam_id && r.winner_display_name ? (
                    <div className="details-link">
                      <PlayerLink steamId={r.winner_steam_id} name={`${r.winner_display_name}'s profile`} />
                    </div>
                  ) : null}
                  <div className="muted" style={{ margin: '6px 0' }}>
                    2nd {r.runner_up_display_name ?? '–'} · 3rd {r.third_place_display_name ?? '–'} · {plural(r.signup_count, 'player')}
                  </div>
                  {detail?.participants?.length ? (
                    <div className="table-wrap">
                      <table className="t">
                        <thead>
                          <tr>
                            <th className="num">Seed</th>
                            <th>Player</th>
                            <th className="num">Elo</th>
                            <th className="num">W-L</th>
                            <th>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.participants.map((p) => (
                            <tr key={p.steam_id}>
                              <td className="num tnum">{p.seed}</td>
                              <td>
                                <PlayerLink steamId={p.steam_id} name={p.display_name} />
                              </td>
                              <td className="num tnum">{p.elo}</td>
                              <td className="num tnum">
                                {p.wins}-{p.losses}
                              </td>
                              <td className={p.placed_rank === 1 ? 'good' : p.forfeited ? 'bad' : 'muted'}>{p.result_label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <Link className="btn" style={{ marginTop: 8 }} to={`/tournaments/${r.tournament_id}`}>
                    Game details
                  </Link>
                </details>
              )
            })}
          </>
        )}
      </QueryState>
    </div>
  )
}
