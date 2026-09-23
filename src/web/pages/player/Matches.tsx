import { useId, useState } from 'react'
import type { CardPick, PlayerMatch } from '../../../shared/api-types'
import { usePlayerSub } from '../../api/hooks'
import { PlayerLink } from '../../components/PlayerLink'
import { Disclosure } from '../../components/Disclosure'
import { Segmented } from '../../components/Segmented'
import { TitleTag } from '../../components/TitleTag'
import { QueryState } from '../../components/QueryState'
import { fmtDate, pct, signed } from '../../lib/format'
import { groupSeries, type SeriesGroup } from '../../lib/series'
import { useFirst } from '../../components/ShowMore'

const GAME_FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'ranked' as const, label: 'Ranked' },
  { id: 'casual' as const, label: 'Casual' },
]

function Cards({ cards }: { cards: CardPick[] | undefined }) {
  if (!cards?.length) return <span className="faint">no picks</span>
  return (
    <span className="chip-row">
      {cards.map((c, i) => (
        // "rolled" is the game's own word for these picks; it's said in text (legible, and readable aloud), not by fading.
        <span key={i} className={`chip card-chip${c.rolled ? ' rolled' : ''}`} title={`${c.card_rarity} · pick ${c.pick_order}, round ${c.round_number}`}>
          {c.card_name}
          {c.rolled ? <span className="rolled-tag"> rolled</span> : null}
        </span>
      ))}
    </span>
  )
}

function Game({ g, n }: { g: PlayerMatch; n: number }) {
  const acc = g.player_bullets_fired ? pct(g.player_bullets_hit / g.player_bullets_fired) : '–'
  return (
    <div className="game-row">
      <div className="row">
        <span className="faint">Game {n}</span>
        <strong className={g.won ? 'good' : 'bad'}>{g.won ? 'W' : 'L'}</strong>
        <span className="nowrap">
          <span className="tnum">
            {g.player_rounds_won}–{g.opponent_rounds_won}
          </span>{' '}
          <span className="faint">rounds</span>
        </span>
        <span className="faint">
          pts {g.player_points}–{g.opponent_points} · hit {acc}
        </span>
        <span className="spacer" />
        <span className="faint">
          +{g.xp_gained} xp · +{g.gold_gained}g
        </span>
      </div>
      <div className="subline">
        <span className="faint">you: </span>
        <Cards cards={g.cards_picked} />
      </div>
      <div className="subline">
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
          return <SeriesList groups={groups} />
        }}
      </QueryState>
    </div>
  )
}

/** Series newest first: the latest 20, the rest on request. */
function SeriesList({ groups }: { groups: SeriesGroup[] }) {
  const listId = useId()
  const { items, button } = useFirst(groups, 20, listId)
  return (
    <>
      <div id={listId}>
        {items.map((g) => (
            <Disclosure
              key={g.key}
              summary={
                <summary className="series-row">
                  <span className={`chip series-kind ${g.ranked ? 'tone-info' : ''}`}>{g.ranked ? 'RANKED' : 'CASUAL'}</span>
                  {/* A summary can't hold a link (nested controls): the name is text here, the profile link sits inside. */}
                  <span className="series-who">
                    <strong>
                      <bdi>{g.opponent_name}</bdi>
                    </strong>
                    <TitleTag title={g.opponent_title} color={g.opponent_title_color} />
                  </span>
                  {g.ranked && g.score ? (
                    <strong className="tnum series-score">{g.score}</strong>
                  ) : (
                    <strong className="tnum series-score">
                      {g.games[0].won ? 'W' : 'L'}
                      <span className="sr-only">{g.games[0].won ? ' (win)' : ' (loss)'}</span>
                    </strong>
                  )}
                  <span className={`tnum series-change ${g.rating_change === null ? '' : g.rating_change >= 0 ? 'good' : 'bad'}`}>{g.rating_change !== null ? signed(g.rating_change, 1) : null}</span>
                  <span className="faint series-date">{fmtDate(g.ended_at)}</span>
                </summary>
              }
              deferred={() => [...g.games].reverse().map((game, i) => <Game key={game.match_id} g={game} n={i + 1} />)}
            >
              <div className="details-link">
                <PlayerLink steamId={g.opponent_steam_id} name={`${g.opponent_name}'s profile`} />
              </div>
            </Disclosure>
        ))}
      </div>
      {button}
    </>
  )
}
