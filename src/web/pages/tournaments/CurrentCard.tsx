import { Link } from 'react-router'
import type { TournamentCurrent, TournamentMatch } from '../../../shared/api-types'
import { PlayerLink } from '../../components/PlayerLink'
import { fmtDate, relTime } from '../../lib/format'

const STATUS_LABEL: Record<string, string> = { voting: 'Voting on a time', locked: 'Locked, starting soon', running: 'Running', completed: 'Completed' }

function when(iso: string | null | undefined): string {
  if (!iso) return '–'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '–'
  return `${fmtDate(iso)} ${new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${t > Date.now() ? 'in ' + relTime(new Date(Date.now() - (t - Date.now())).toISOString()).replace(' ago', '') : relTime(iso)})`
}

function byRound(matches: TournamentMatch[]): Array<[string, TournamentMatch[]]> {
  const map = new Map<string, TournamentMatch[]>()
  for (const m of matches) {
    const key = `${m.bracket_side === 'losers' ? 'Losers ' : m.bracket_side === 'grand' ? 'Grand final ' : ''}Round ${m.round}`
    map.set(key, [...(map.get(key) ?? []), m])
  }
  return [...map.entries()]
}

export function CurrentCard({ t, kind }: { t: TournamentCurrent | null; kind: 'sync' | 'async' }) {
  const title = kind === 'sync' ? 'Weekly sync tournament' : 'Async tournament'
  if (!t || !t.tournament_id) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <div className="empty">Nothing scheduled right now.</div>
      </div>
    )
  }
  const status = t.status ?? ''
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <span className={`chip ${status === 'running' ? 'live-pill' : ''}`} style={status !== 'running' ? { background: 'var(--bg-elev)' } : undefined}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      <div className="muted">
        {status === 'voting' ? `Voting closes ${when(t.voting_closes_at)} · default start ${when(t.default_start_ts)}` : null}
        {status === 'locked' ? `Starts ${when(t.scheduled_start_ts ?? t.default_start_ts)}` : null}
        {status === 'running' ? `Started ${when(t.started_at)}` : null}
        {status === 'completed' ? `Ended ${when(t.ended_at)}` : null}
      </div>
      {t.prize_gold_1 ? (
        <div className="faint" style={{ marginTop: 4 }}>
          Prizes: {t.prize_gold_1}g / {t.prize_gold_2}g / {t.prize_gold_3}g · {t.min_players}–{t.max_players} players
        </div>
      ) : null}

      <h3 style={{ marginTop: 12 }}>Signups ({t.signups.length})</h3>
      {t.signups.length === 0 ? <div className="faint">No signups yet.</div> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {t.signups.map((s) => (
          <li key={s.signup_id} className="row" style={{ minHeight: 32 }}>
            {s.seed ? <span className="faint mono">#{s.seed}</span> : null}
            <PlayerLink steamId={s.steam_id} name={s.display_name} title={s.title} titleColor={s.title_color} />
            <span className="muted mono">{Math.round(s.rating)}</span>
            <span className="spacer" />
            {s.placed_rank ? <span className="chip">placed #{s.placed_rank}</span> : s.forfeited ? <span className="chip bad">forfeited</span> : s.progress_label ? <span className="faint">{s.progress_label}</span> : null}
          </li>
        ))}
      </ul>

      {t.time_slot_tallies?.length ? (
        <>
          <h3 style={{ marginTop: 12 }}>Time votes</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {t.time_slot_tallies.map((v) => (
              <li key={v.slot_ts} className="row">
                <span>{when(v.slot_ts)}</span>
                <span className="muted">{v.votes} votes</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {t.matches.length ? (
        <>
          <h3 style={{ marginTop: 12 }}>Bracket</h3>
          {byRound(t.matches).map(([round, ms]) => (
            <div key={round} style={{ marginBottom: 8 }}>
              <div className="faint">{round}</div>
              {ms.map((m) => (
                <div key={m.match_id} className="row" style={{ minHeight: 32 }}>
                  <span style={{ fontWeight: m.winner_signup_id && m.winner_signup_id === m.p1_signup_id ? 800 : 500 }}>{m.p1_display_name ?? (m.is_bye ? 'bye' : 'TBD')}</span>
                  <span className="mono">
                    {m.p1_series_wins ?? 0}–{m.p2_series_wins ?? 0}
                  </span>
                  <span style={{ fontWeight: m.winner_signup_id && m.winner_signup_id === m.p2_signup_id ? 800 : 500 }}>{m.p2_display_name ?? (m.is_bye ? 'bye' : 'TBD')}</span>
                  <span className="spacer" />
                  <span className="faint">{m.status}</span>
                </div>
              ))}
            </div>
          ))}
          <Link className="btn" to={`/tournaments/${t.tournament_id}`}>
            Game details
          </Link>
        </>
      ) : null}
    </div>
  )
}
