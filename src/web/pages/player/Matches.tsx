import { useState } from 'react'
import type { CardPick, PlayerMatch } from '../../../shared/api-types'
import { usePlayerSub } from '../../api/hooks'
import { PlayerLink } from '../../components/PlayerLink'
import { Segmented } from '../../components/Segmented'
import { TitleTag } from '../../components/TitleTag'
import { QueryState } from '../../components/QueryState'
import { fmtDate, pct, signed } from '../../lib/format'
import { groupSeries } from '../../lib/series'

const GAME_FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'ranked' as const, label: 'Ranked' },
  { id: 'casual' as const, label: 'Casual' },
]

function Cards({ cards }: { cards: CardPick[] | undefined }) {
  if (!cards?.length) return <span className="faint">no picks</span>
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      {cards.map((c, i) => (
        <span key={i} className="chip card-chip" style={c.rolled ? { opacity: 0.5 } : undefined} title={`${c.card_rarity} · pick ${c.pick_order}, round ${c.round_number}`}>
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
        <span className="tnum">
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
      <div className="toolbar">
        <Segmented options={GAME_FILTERS} value={filter} onChange={setFilter} label="Games shown" />
      </div>
      <QueryState q={q} label="matches" empty={(d) => d.length === 0} emptyHint="Matches appear once the mod reports them.">
        {(rows) => {
          const groups = groupSeries(rows).filter((g) => filter === 'all' || (filter === 'ranked') === g.ranked)
          if (!groups.length) return <div className="empty">No {filter} matches in the last 100 games.</div>
          return groups.map((g) => (
            <details key={g.key} className="acc">
              <summary className="row">
                <span className={`chip ${g.ranked ? 'tone-info' : ''}`}>
                  {g.ranked ? 'RANKED' : 'casual'}
                </span>
                {/* A summary can't hold a link (nested controls): the name is text here, the profile link sits inside. */}
                <strong>
                  <bdi>{g.opponent_name}</bdi>
                </strong>
                <TitleTag title={g.opponent_title} color={g.opponent_title_color} />
                <span className="spacer" />
                {g.ranked && g.score ? (
                  <strong className="tnum">{g.score}</strong>
                ) : (
                  <strong className="tnum">
                    {g.games[0].won ? 'W' : 'L'}
                    <span className="sr-only">{g.games[0].won ? ' (win)' : ' (loss)'}</span>
                  </strong>
                )}
                {g.rating_change !== null ? <span className={`tnum ${g.rating_change >= 0 ? 'good' : 'bad'}`}>{signed(g.rating_change, 1)}</span> : null}
                <span className="faint">{fmtDate(g.ended_at)}</span>
              </summary>
              <div className="details-link">
                <PlayerLink steamId={g.opponent_steam_id} name={`${g.opponent_name}'s profile`} />
              </div>
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
