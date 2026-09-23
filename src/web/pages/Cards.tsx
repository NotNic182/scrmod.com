import { useTitle } from '../lib/title'
import { Fragment, useId, useState } from 'react'
import { Link } from 'react-router'
import { useCardLeaders, useCardPickers, useCards } from '../api/hooks'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { Icon } from '../components/Icon'
import { Segmented } from '../components/Segmented'
import { num, pct, plural } from '../lib/format'
import { useFirst } from '../components/ShowMore'
import { cardSlug, INTROS, pageMeta } from '../../shared/seo'
import type { CardStat } from '../../shared/api-types'

const FILTERS: Array<{ id: 'all' | 'ranked' | 'casual'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'ranked', label: 'Ranked' },
  { id: 'casual', label: 'Casual' },
]
const SORTS: Array<{ id: string; label: string }> = [
  { id: 'times_picked', label: 'Most picked' },
  { id: 'win_rate', label: 'Win rate' },
  { id: 'pass_rate', label: 'Pass rate' },
  { id: 'unique_players', label: 'Unique players' },
  { id: 'times_offered', label: 'Most offered' },
]

export function Pickers({ name }: { name: string }) {
  const q = useCardPickers(name)
  return (
    <QueryState q={q} label="top pickers" empty={(d) => !d.display_names?.length}>
      {(d) => (
        <ul className="plain-list">
          {d.display_names.map((n, i) => (
            <li key={d.steam_ids[i] ?? i} className="row list-row">
              <PlayerLink steamId={d.steam_ids[i]} name={n} />
              <span className="spacer" />
              <span className="muted">{plural(d.picks[i], 'pick')}</span>
              <span className={`tnum ${d.win_rates[i] >= 0.55 ? 'good' : d.win_rates[i] <= 0.45 ? 'bad' : ''}`}>{pct(d.win_rates[i])}</span>
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  )
}

export function Cards() {
  useTitle(pageMeta({ kind: 'cards' }).title)
  const [filter, setFilter] = useState<'all' | 'ranked' | 'casual'>('all')
  const [sort, setSort] = useState('times_picked')
  const [open, setOpen] = useState<string | null>(null)
  const q = useCards(filter, sort, 'desc')
  const leaders = useCardLeaders()
  return (
    <>
      <h1>Cards</h1>
      <p className="page-intro">{INTROS.cards}</p>
      <div className="toolbar">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Games counted" />
        <div className="row">
          <label className="muted" htmlFor="cards-sort">
            Sort
          </label>
          <select id="cards-sort" className="input sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="card">
        <QueryState q={q} label="card stats" empty={(d) => d.length === 0}>
          {(rows) => <CardTable rows={rows} open={open} setOpen={setOpen} />}
        </QueryState>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Most wins with a card</h2>
          <QueryState q={leaders} label="card leaders" empty={(d) => !d.winners?.length}>
            {(d) => <LeaderList rows={d.winners} />}
          </QueryState>
        </div>
        <div className="card">
          <h2>Most 5-0 sweeps with a card</h2>
          <QueryState q={leaders} label="card leaders" empty={(d) => !d.sweepers?.length}>
            {(d) => <LeaderList rows={d.sweepers} />}
          </QueryState>
        </div>
      </div>
    </>
  )
}

/** The card table: the 20 most relevant under the current sort, the rest on request. */
function CardTable({ rows, open, setOpen }: { rows: CardStat[]; open: string | null; setOpen: (name: string | null) => void }) {
  const tableId = useId()
  const { items, button } = useFirst(rows, 20, tableId)
  return (
    <>
      <div className="table-wrap">
        <table className="t" id={tableId}>
          <thead>
            <tr>
              <th className="stick-lead">Card</th>
              <th>Rarity</th>
              <th className="num">Picks</th>
              <th className="num">Offered</th>
              <th className="num">Pass %</th>
              <th className="num">Win %</th>
              <th className="num">Players</th>
              <th className="num">Sweeps</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <Fragment key={c.card_name}>
                <tr>
                  <td className="stick-lead">
                    <span className="row tight">
                      <button className="disclosure" onClick={() => setOpen(open === c.card_name ? null : c.card_name)} aria-expanded={open === c.card_name} aria-label={`Top pickers of ${c.card_name}`}>
                        <Icon name="chevron" size={16} />
                      </button>
                      <Link to={`/cards/${cardSlug(c.card_name)}`}>{c.card_name}</Link>
                    </span>
                  </td>
                  <td className={`rarity-${String(c.card_rarity).toLowerCase()}`}>{c.card_rarity}</td>
                  <td className="num">{num(c.times_picked)}</td>
                  <td className="num">{num(c.times_offered)}</td>
                  <td className="num">{pct(c.pass_rate)}</td>
                  <td className={`num ${c.win_rate >= 0.55 ? 'good' : c.win_rate <= 0.45 ? 'bad' : ''}`}>{pct(c.win_rate)}</td>
                  <td className="num">{num(c.unique_players)}</td>
                  <td className="num">{num(c.sweeps_with_card)}</td>
                </tr>
                {open === c.card_name ? (
                  <tr>
                    <td colSpan={8} className="pickers-cell">
                      <strong>Top pickers of {c.card_name}</strong>
                      <Pickers name={c.card_name} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {button}
    </>
  )
}

/** One of the two card-leader lists: card, player, count. */
function LeaderList({ rows }: { rows: Array<{ card: string; player: string; count: number }> }) {
  return (
    <ul className="plain-list">
      {[...rows].sort((a, b) => b.count - a.count).slice(0, 15).map((w, i) => (
        <li key={i} className="row list-row">
          <span>{w.card}</span>
          <bdi className="muted">{w.player}</bdi>
          <span className="spacer" />
          <span className="tnum">{w.count}</span>
        </li>
      ))}
    </ul>
  )
}
