import type { ActiveSeries, ActiveTeamSeries, FfaLobby, SpectateGame } from '../../shared/api-types'
import { relTime } from '../lib/format'
import { PlayerLink } from './PlayerLink'

export function LiveSeries1v1({ s }: { s: ActiveSeries }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip live-pill">{s.phase === 'live' ? 'LIVE' : 'STARTING'}</span>
        {s.is_tournament && s.tournament_label ? <span className="chip">{s.tournament_label}</span> : null}
        {s.is_private ? <span className="chip">private room</span> : null}
        <span className="spacer" />
        <span className="faint">{relTime(s.started_at)}</span>
      </div>
      <div className="row" style={{ marginTop: 8, fontSize: 17 }}>
        <PlayerLink steamId={s.p1_steam_id} name={s.p1_name} bold />
        <span className="muted mono">{s.p1_rating}</span>
        <span className="mono" style={{ fontWeight: 900, fontSize: 20, margin: '0 8px' }}>
          {s.p1_wins} – {s.p2_wins}
        </span>
        <span className="muted mono">{s.p2_rating}</span>
        <PlayerLink steamId={s.p2_steam_id} name={s.p2_name} bold />
      </div>
      <div className="faint" style={{ marginTop: 4 }}>
        Best of 3 · current game {s.live_p1_points}–{s.live_p2_points}
        {s.bets_locked ? ' · bets locked' : ` · odds ${s.p1_odds}× / ${s.p2_odds}×`}
      </div>
    </div>
  )
}

export function LiveSeries2v2({ s }: { s: ActiveTeamSeries }) {
  const team = (a: [string, string], b: [string, string], color: string) => (
    <span className="row" style={{ gap: 6 }}>
      <span className="dot on" style={{ background: color || 'var(--fg-faint)', boxShadow: 'none' }} />
      <PlayerLink steamId={a[0]} name={a[1]} />
      <span className="faint">&amp;</span>
      <PlayerLink steamId={b[0]} name={b[1]} />
    </span>
  )
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip live-pill">LIVE 2v2</span>
        <span className="spacer" />
        <span className="faint">{relTime(s.started_at)}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {team([s.t1a_steam, s.t1a_name], [s.t1b_steam, s.t1b_name], s.t1_color_hex)}
        <div className="mono" style={{ fontWeight: 900, fontSize: 20, margin: '4px 0' }}>
          {s.t1_wins} – {s.t2_wins}
        </div>
        {team([s.t2a_steam, s.t2a_name], [s.t2b_steam, s.t2b_name], s.t2_color_hex)}
      </div>
      <div className="faint" style={{ marginTop: 4 }}>
        Team ratings {s.t1_rating} vs {s.t2_rating} · current game {s.live_t1_points ?? 0}–{s.live_t2_points ?? 0}
      </div>
    </div>
  )
}

export function FfaLobbyCard({ l }: { l: FfaLobby }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip live-pill">FFA LOBBY</span>
        <strong>{l.host_name}'s lobby</strong>
        <span className="muted">
          {l.player_count}/{l.max_players}
        </span>
        {l.has_password ? <span className="chip">locked</span> : null}
        <span className="spacer" />
        <span className="faint">open {relTime(new Date(Date.now() - l.age_seconds * 1000).toISOString())}</span>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        {l.members.map((m, i) => (
          <span key={i} className="chip" style={{ background: 'var(--bg-elev)' }}>
            {m.name} <span className="muted">{m.rating}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function SpectateCard({ g }: { g: SpectateGame }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="row">
        <span className="chip">{g.mode.toUpperCase()}</span>
        <strong>{g.names}</strong>
        <span className="spacer" />
        <span className="faint">
          {g.spectatable ? `${g.spectator_count}/${g.spectator_cap} watching` : 'not spectatable'}
        </span>
      </div>
      <div className="faint">Watch from the game: F5 → Leaderboard → WATCH</div>
    </div>
  )
}
