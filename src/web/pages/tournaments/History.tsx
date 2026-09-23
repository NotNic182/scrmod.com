import { Link } from 'react-router'
import { useTournamentHistory } from '../../api/hooks'
import { PlayerLink } from '../../components/PlayerLink'
import { QueryState } from '../../components/QueryState'
import { fmtDate, plural } from '../../lib/format'
import { Icon } from '../../components/Icon'
import { Disclosure } from '../../components/Disclosure'
import type { TournamentParticipant } from '../../../shared/api-types'

/** Final standings of one past tournament, built when its row is opened. */
function Standings({ participants }: { participants: TournamentParticipant[] | undefined }) {
  if (!participants?.length) return null
  return (
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
          {participants.map((p) => (
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
  )
}

export function History() {
  const q = useTournamentHistory()
  return (
    <div className="card">
      <h2>Past tournaments</h2>
      <QueryState q={q} label="tournament history" empty={(d) => !d.rows?.length}>
        {(d) => (
          <>
            {d.rows.map((r) => {
              const detail = d.detail?.find((x) => x.tournament_id === r.tournament_id)
              return (
                <Disclosure
                  key={r.tournament_id}
                  summary={
                    <summary className="row">
                      <span className="chip">{r.kind}</span>
                      {r.format ? <span className="faint">{r.format.replace(/_/g, ' ')}</span> : null}
                      <span className="spacer" />
                      <span className="row tight">
                        <Icon name="trophy" size={16} />
                        <span className="sr-only">Winner:</span>
                        <strong>
                          <bdi>{r.winner_display_name ?? '–'}</bdi>
                        </strong>
                      </span>
                      <span className="faint">{fmtDate(r.ended_at)}</span>
                    </summary>
                  }
                  deferred={() => (
                    <>
                      <Standings participants={detail?.participants} />
                      <Link className="btn trailing" to={`/tournaments/${r.tournament_id}`}>
                        Game details
                      </Link>
                    </>
                  )}
                >
                  {r.winner_steam_id && r.winner_display_name ? (
                    <div className="details-link">
                      <PlayerLink steamId={r.winner_steam_id} name={`${r.winner_display_name}'s profile`} />
                    </div>
                  ) : null}
                  <div className="muted podium">
                    2nd <bdi>{r.runner_up_display_name ?? '–'}</bdi> · 3rd <bdi>{r.third_place_display_name ?? '–'}</bdi> · {plural(r.signup_count ?? 0, 'player')}
                  </div>
                </Disclosure>
              )
            })}
          </>
        )}
      </QueryState>
    </div>
  )
}
