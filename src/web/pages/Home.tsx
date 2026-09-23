import { useId } from 'react'
import { useTitle } from '../lib/title'
import { Link } from 'react-router'
import { useHome } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { PlayerLink } from '../components/PlayerLink'
import { FfaLobbyCard, LiveSeries1v1, LiveSeries2v2, SpectateCard } from '../components/LiveSeriesCard'
import { ResultTable } from '../components/ResultTable'
import { StreamCard } from '../components/Stream'
import { useIdentity } from '../lib/identity'
import { agoFromMinutes } from '../lib/format'
import { useFirst } from '../components/ShowMore'
import { pageMeta } from '../../shared/seo'
import type { PresenceEntry } from '../../shared/api-types'

/** Players seen lately but not online now: the five most recent, the rest on request. */
function RecentlyOnline({ players, me }: { players: PresenceEntry[]; me: string | undefined }) {
  const heading = useId()
  const list = useId()
  const { items, button } = useFirst(players, 5, list)
  return (
    <>
      <h3 id={heading}>Recently online</h3>
      <ul className="plain-list" id={list} aria-labelledby={heading}>
        {items.map((p) => (
          <li key={p.steam_id} className={`row list-row${me === p.steam_id ? ' me-row' : ''}`}>
            <PlayerLink steamId={p.steam_id} name={p.display_name} title={p.title} titleColor={p.title_color} me={me === p.steam_id} />
            <span className="spacer" />
            <span className="faint">{agoFromMinutes(p.minutes_ago)}</span>
          </li>
        ))}
      </ul>
      {button}
    </>
  )
}

export function Home() {
  useTitle(pageMeta({ kind: 'home' }).title)
  const q = useHome()
  const id = useIdentity()
  return (
    <>
      <h1>Right now</h1>
      <p className="page-intro">
        <Link to="/guide">New to ranked ROUNDS? Start here →</Link>
      </p>
      <StreamCard watchLink />
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

              <div className="tiles">
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

              {/* Not equals: each column keeps its own height rather than stretching to the taller one. */}
              <div className="grid-2 top">
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
                      <li key={p.steam_id} className={`row list-row${id.me?.steam_id === p.steam_id ? ' me-row' : ''}`}>
                        <PlayerLink steamId={p.steam_id} name={p.display_name} title={p.title} titleColor={p.title_color} online me={id.me?.steam_id === p.steam_id} />
                        <span className="spacer" />
                        <span className="tnum muted">{p.rating}</span>
                      </li>
                    ))}
                  </ul>
                  {d.presence.recent.length ? <RecentlyOnline players={d.presence.recent} me={id.me?.steam_id} /> : null}
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
                {d.results.length ? <ResultTable rows={d.results.slice(0, 12)} /> : null}
              </section>
            </>
          )
        }}
      </QueryState>
    </>
  )
}
