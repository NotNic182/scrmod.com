import { Link } from 'react-router'
import type { TournamentCurrent, TournamentMatch } from '../../../shared/api-types'
import { PlayerLink } from '../../components/PlayerLink'
import { localDateTime, plural, untilOrAgo } from '../../lib/format'

const STATUS_LABEL: Record<string, string> = { voting: 'Voting on a time', locked: 'Locked, starting soon', running: 'Running', completed: 'Completed' }

/** "Sep 23, 06:00 PM (in 3h)", date and time both on the viewer's clock. */
function when(iso: string | null | undefined): string {
  const at = localDateTime(iso)
  const rel = untilOrAgo(iso)
  return rel ? `${at} (${rel})` : at
}

/** A bracket slot's occupant: a name (isolated, it may be right-to-left), a bye, or not decided yet. */
function Slot({ name, bye, won }: { name: string | null; bye: boolean; won: boolean }) {
  return (
    <span className={won ? 'slot won' : 'slot'}>
      {name ? <bdi>{name}</bdi> : bye ? 'bye' : 'TBD'}
      {won ? <span className="sr-only"> (won)</span> : null}
    </span>
  )
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
  const signups = t.signups ?? []
  const matches = t.matches ?? []
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <span className={`chip ${status === 'running' ? 'live-pill' : ''}`}>
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
        <div className="faint subline">
          Prizes: {t.prize_gold_1}g / {t.prize_gold_2}g / {t.prize_gold_3}g · {t.min_players}–{t.max_players} players
        </div>
      ) : null}

      <h3>Signups ({signups.length})</h3>
      {signups.length === 0 ? <div className="faint">No signups yet.</div> : null}
      <ul className="plain-list">
        {signups.map((s) => (
          <li key={s.signup_id} className="row list-row">
            {s.seed ? <span className="faint tnum">#{s.seed}</span> : null}
            <PlayerLink steamId={s.steam_id} name={s.display_name} title={s.title} titleColor={s.title_color} />
            <span className="muted tnum">{Math.round(s.rating)}</span>
            <span className="spacer" />
            {s.placed_rank ? <span className="chip">placed #{s.placed_rank}</span> : s.forfeited ? <span className="chip tone-bad">forfeited</span> : s.progress_label ? <span className="faint">{s.progress_label}</span> : null}
          </li>
        ))}
      </ul>

      {t.time_slot_tallies?.length ? (
        <>
          <h3>Time votes</h3>
          <ul className="plain-list">
            {t.time_slot_tallies.map((v) => (
              <li key={v.slot_ts} className="row">
                <span>{when(v.slot_ts)}</span>
                <span className="muted">{plural(v.votes, 'vote')}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {matches.length ? (
        <>
          <h3>Bracket</h3>
          {byRound(matches).map(([round, ms]) => (
            <div key={round} className="round-group">
              <div className="faint">{round}</div>
              {ms.map((m) => (
                <div key={m.match_id} className="row list-row">
                  <Slot name={m.p1_display_name} bye={m.is_bye} won={!!m.winner_signup_id && m.winner_signup_id === m.p1_signup_id} />
                  <span className="tnum">
                    {m.p1_series_wins ?? 0}–{m.p2_series_wins ?? 0}
                  </span>
                  <Slot name={m.p2_display_name} bye={m.is_bye} won={!!m.winner_signup_id && m.winner_signup_id === m.p2_signup_id} />
                  <span className="spacer" />
                  <span className="faint">{m.status}</span>
                </div>
              ))}
            </div>
          ))}
          <Link className="btn trailing" to={`/tournaments/${t.tournament_id}`}>
            Game details
          </Link>
        </>
      ) : null}
    </div>
  )
}
