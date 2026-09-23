import { useTitle } from '../lib/title'
import { Fragment, useState } from 'react'
import { useCardLeaders, useCardPickers, useCards } from '../api/hooks'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { Icon } from '../components/Icon'
import { Segmented } from '../components/Segmented'
import { num, pct, plural } from '../lib/format'

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

function Pickers({ name }: { name: string }) {
  const q = useCardPickers(name)
  return (
    <QueryState q={q} label="top pickers" empty={(d) => !d.display_names?.length}>
      {(d) => (
        <ul className="plain-list">
          {d.display_names.map((n, i) => (
            <li key={d.steam_ids[i] ?? i} className="row" style={{ minHeight: 30 }}>
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
  useTitle('Cards')
  const [filter, setFilter] = useState<'all' | 'ranked' | 'casual'>('all')
  const [sort, setSort] = useState('times_picked')
  const [open, setOpen] = useState<string | null>(null)
  const q = useCards(filter, sort, 'desc')
  const leaders = useCardLeaders()
  return (
    <>
      <h1>Cards</h1>
      <div className="toolbar">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Games counted" />
        <div className="row">
          <label className="muted" htmlFor="cards-sort">
            Sort
          </label>
          <select id="cards-sort" className="input" style={{ maxWidth: 220 }} value={sort} onChange={(e) => setSort(e.target.value)}>
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
          {(rows) => (
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>Card</th>
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
                  {rows.map((c) => (
                    <Fragment key={c.card_name}>
                      <tr>
                        <td>
                          <button className="disclosure" onClick={() => setOpen(open === c.card_name ? null : c.card_name)} aria-expanded={open === c.card_name}>
                            <Icon name="chevron" size={16} />
                            {c.card_name}
                          </button>
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
                          <td colSpan={8} style={{ background: 'var(--bg-elev)' }}>
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
          )}
        </QueryState>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Most wins with a card</h2>
          <QueryState q={leaders} label="card leaders" empty={(d) => !d.winners?.length}>
            {(d) => (
              <ul className="plain-list">
                {[...d.winners].sort((a, b) => b.count - a.count).slice(0, 15).map((w, i) => (
                  <li key={i} className="row" style={{ minHeight: 30 }}>
                    <span>{w.card}</span>
                    <span className="muted">{w.player}</span>
                    <span className="spacer" />
                    <span className="tnum">{w.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
        <div className="card">
          <h2>Most 5-0 sweeps with a card</h2>
          <QueryState q={leaders} label="card leaders" empty={(d) => !d.sweepers?.length}>
            {(d) => (
              <ul className="plain-list">
                {[...d.sweepers].sort((a, b) => b.count - a.count).slice(0, 15).map((w, i) => (
                  <li key={i} className="row" style={{ minHeight: 30 }}>
                    <span>{w.card}</span>
                    <span className="muted">{w.player}</span>
                    <span className="spacer" />
                    <span className="tnum">{w.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      </div>
    </>
  )
}
