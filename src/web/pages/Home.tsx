import { useTitle } from '../lib/title'
import { Link } from 'react-router'
import { useHome } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { PlayerLink } from '../components/PlayerLink'
import { FfaLobbyCard, LiveSeries1v1, LiveSeries2v2, SpectateCard } from '../components/LiveSeriesCard'
import { useIdentity } from '../lib/identity'
import { relTime, signed, agoFromMinutes } from '../lib/format'
import type { MultimodeEntry } from '../../shared/api-types'

const MODE_LABEL: Record<string, string> = { '1v1': '1v1', '2v2': '2v2', ffa: 'FFA', ovt: '1v2' }

export function ResultRow({ e }: { e: MultimodeEntry }) {
  return (
    <tr>
      <td>
        <span className="chip">{MODE_LABEL[e.mode] ?? e.mode}</span>
      </td>
      <td>
        <strong>
          <bdi>{e.left_label}</bdi>
        </strong>
        {e.left_rating_change !== null && e.left_rating_change !== undefined ? (
          <span className={`tnum ${e.left_rating_change >= 0 ? 'good' : 'bad'}`} style={{ marginLeft: 6 }}>
            {signed(e.left_rating_change, 1)}
          </span>
        ) : null}
      </td>
      <td className="tnum" style={{ fontWeight: 800 }}>
        {e.score}
      </td>
      <td>
        <bdi>{e.right_label}</bdi>
        {e.right_rating_change !== null && e.right_rating_change !== undefined ? (
          <span className={`tnum ${e.right_rating_change >= 0 ? 'good' : 'bad'}`} style={{ marginLeft: 6 }}>
            {signed(e.right_rating_change, 1)}
          </span>
        ) : null}
      </td>
      <td className="faint">{relTime(e.ended_at)}</td>
    </tr>
  )
}

export function Home() {
  useTitle(null)
  const q = useHome()
  const id = useIdentity()
  return (
    <>
      <h1>Right now</h1>
      <QueryState q={q} label="live data">
        {(d, meta) => {
          const liveCount = d.live.series_1v1.length + d.live.series_2v2.length + d.live.ffa_lobbies.length
          return (
            <>
              {d.maintenance ? <div className="banner warn">Sid's server is in maintenance. Data may pause for a few minutes.</div> : null}
              {d.alerts.map((a, i) => (
                <div key={i} className="banner warn">
                  {a.message}
                </div>
              ))}
              {meta.errors.length ? <div className="banner bad">Some sections could not be loaded: {meta.errors.join(', ')}.</div> : null}

              <div className="tiles" style={{ marginBottom: 14 }}>
                <div className="tile">
                  <div className="label">Online now</div>
                  <div className="value">{d.presence.online_count}</div>
                  <div className="sub">mod players</div>
                </div>
                <div className="tile">
                  <div className="label">Ranked queue</div>
                  <div className="value">{d.queue.ranked_searching}</div>
                  <div className="sub">{d.queue.ranked_searching === 1 ? '1 searching' : `${d.queue.ranked_searching} searching`}</div>
                </div>
                <div className="tile">
                  <div className="label">2v2 queue</div>
                  <div className="value">{d.queue.team_searching}</div>
                  <div className="sub">searching</div>
                </div>
                <div className="tile">
                  <div className="label">Live games</div>
                  <div className="value">{liveCount}</div>
                  <div className="sub">1v1, 2v2 and FFA</div>
                </div>
              </div>

              <div className="grid-2">
                <section className="card">
                  <div className="card-head">
                    <h2>Live games</h2>
                  </div>
                  {liveCount === 0 && d.live.spectate.length === 0 ? <div className="empty">No live games right now.</div> : null}
                  {d.live.series_1v1.map((s) => (
                    <LiveSeries1v1 key={s.series_id} s={s} />
                  ))}
                  {d.live.series_2v2.map((s) => (
                    <LiveSeries2v2 key={s.series_id} s={s} />
                  ))}
                  {d.live.ffa_lobbies.map((l) => (
                    <FfaLobbyCard key={l.lobby_id} l={l} />
                  ))}
                  {d.live.spectate.map((g) => (
                    <SpectateCard key={g.game_id} g={g} />
                  ))}
                </section>

                <section className="card">
                  <div className="card-head">
                    <h2>Who's on</h2>
                    <span className="muted">{d.presence.online_count} online</span>
                  </div>
                  {d.presence.online.length === 0 ? <div className="empty">Nobody online at the moment.</div> : null}
                  <ul className="plain-list">
                    {d.presence.online.map((p) => (
                      <li key={p.steam_id} className="row" style={{ minHeight: 36 }}>
                        <PlayerLink steamId={p.steam_id} name={p.display_name} title={p.title} titleColor={p.title_color} online me={id.me?.steam_id === p.steam_id} />
                        <span className="spacer" />
                        <span className="tnum muted">{p.rating}</span>
                      </li>
                    ))}
                  </ul>
                  {d.presence.recent.length ? (
                    <>
                      <h3 style={{ marginTop: 12 }}>Recently online</h3>
                      <ul className="plain-list">
                        {d.presence.recent.map((p) => (
                          <li key={p.steam_id} className="row" style={{ minHeight: 32 }}>
                            <PlayerLink steamId={p.steam_id} name={p.display_name} title={p.title} titleColor={p.title_color} me={id.me?.steam_id === p.steam_id} />
                            <span className="spacer" />
                            <span className="faint">{agoFromMinutes(p.minutes_ago)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </section>
              </div>

              <section className="card">
                <div className="card-head">
                  <h2>Latest results</h2>
                  <Link to="/results" className="muted">
                    all results →
                  </Link>
                </div>
                {d.results.length === 0 ? <div className="empty">No recent results.</div> : null}
                {d.results.length ? (
                  <div className="table-wrap">
                    <table className="t">
                      <tbody>
                        {d.results.slice(0, 12).map((e) => (
                          <ResultRow key={`${e.mode}-${e.id}`} e={e} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            </>
          )
        }}
      </QueryState>
    </>
  )
}
