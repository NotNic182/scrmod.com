import { useState } from 'react'
import type { CardPick, PlayerMatch } from '../../../shared/api-types'
import { usePlayerSub } from '../../api/hooks'
import { PlayerLink } from '../../components/PlayerLink'
import { QueryState } from '../../components/QueryState'
import { fmtDate, pct, signed } from '../../lib/format'
import { groupSeries } from '../../lib/series'

function Cards({ cards }: { cards: CardPick[] | undefined }) {
  if (!cards?.length) return <span className="faint">no picks</span>
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      {cards.map((c, i) => (
        <span key={i} className="chip" style={{ background: 'var(--bg-elev)', fontWeight: 500, opacity: c.rolled ? 0.5 : 1 }} title={`${c.card_rarity} · pick ${c.pick_order}, round ${c.round_number}`}>
          {c.card_name}
        </span>
      ))}
    </span>
  )
}

function Game({ g, n }: { g: PlayerMatch; n: number }) {
  const acc = g.player_bullets_fired ? pct(g.player_bullets_hit / g.player_bullets_fired) : '–'
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
      <div className="row">
        <span className="faint">Game {n}</span>
        <strong className={g.won ? 'good' : 'bad'}>{g.won ? 'W' : 'L'}</strong>
        <span className="mono">
          {g.player_rounds_won}–{g.opponent_rounds_won}
        </span>
        <span className="faint">
          rounds · pts {g.player_points}–{g.opponent_points} · hit {acc}
        </span>
        <span className="spacer" />
        <span className="faint">
          +{g.xp_gained} xp · +{g.gold_gained}g
        </span>
      </div>
      <div style={{ marginTop: 4 }}>
        <span className="faint">you: </span>
        <Cards cards={g.cards_picked} />
      </div>
      <div style={{ marginTop: 4 }}>
        <span className="faint">them: </span>
        <Cards cards={g.opponent_cards_picked} />
      </div>
    </div>
  )
}

export function Matches({ steamId }: { steamId: string }) {
  const [filter, setFilter] = useState<'all' | 'ranked' | 'casual'>('all')
  const q = usePlayerSub(steamId, 'matches', { limit: 100 })
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        {(['all', 'ranked', 'casual'] as const).map((f) => (
          <button key={f} className={`btn${filter === f ? ' btn-accent' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <QueryState q={q} label="matches" empty={(d) => d.length === 0} emptyHint="Matches appear once the mod reports them.">
        {(rows) => {
          const groups = groupSeries(rows).filter((g) => filter === 'all' || (filter === 'ranked') === g.ranked)
          if (!groups.length) return <div className="empty">No {filter} matches in the last 100 games.</div>
          return groups.map((g) => (
            <details key={g.key} className="card" style={{ marginBottom: 8 }}>
              <summary className="row" style={{ cursor: 'pointer', minHeight: 40 }}>
                <span className={`chip ${g.ranked ? 'live-pill' : ''}`} style={g.ranked ? { background: 'var(--info)' } : { background: 'var(--bg-elev)' }}>
                  {g.ranked ? 'RANKED' : 'casual'}
                </span>
                <PlayerLink steamId={g.opponent_steam_id} name={g.opponent_name} title={g.opponent_title} titleColor={g.opponent_title_color} />
                <span className="spacer" />
                {g.ranked && g.score ? <strong className="mono">{g.score}</strong> : <strong className="mono">{g.games[0].won ? 'W' : 'L'}</strong>}
                {g.rating_change !== null ? <span className={`mono ${g.rating_change >= 0 ? 'good' : 'bad'}`}>{signed(g.rating_change, 1)}</span> : null}
                <span className="faint">{fmtDate(g.ended_at)}</span>
              </summary>
              {[...g.games].reverse().map((game, i) => (
                <Game key={game.match_id} g={game} n={i + 1} />
              ))}
            </details>
          ))
        }}
      </QueryState>
    </div>
  )
}
