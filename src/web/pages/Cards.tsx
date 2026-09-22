import { Fragment, useState } from 'react'
import { useCardLeaders, useCardPickers, useCards } from '../api/hooks'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { Tabs } from '../components/Tabs'
import { num, pct } from '../lib/format'

const FILTERS = [
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
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {d.display_names.map((n, i) => (
            <li key={d.steam_ids[i] ?? i} className="row" style={{ minHeight: 30 }}>
              <PlayerLink steamId={d.steam_ids[i]} name={n} />
              <span className="spacer" />
              <span className="muted">{d.picks[i]} picks</span>
              <span className={`mono ${d.win_rates[i] >= 0.55 ? 'good' : d.win_rates[i] <= 0.45 ? 'bad' : ''}`}>{pct(d.win_rates[i])}</span>
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  )
}

export function Cards() {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('times_picked')
  const [open, setOpen] = useState<string | null>(null)
  const order = sort === 'pass_rate' ? 'desc' : 'desc'
  const q = useCards(filter, sort, order)
  const leaders = useCardLeaders()
  return (
    <>
      <h1>Cards</h1>
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
      <div className="row" style={{ marginBottom: 10 }}>
        <label className="muted">Sort</label>
        <select className="input" style={{ maxWidth: 220 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort cards">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
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
                          <button className="btn" style={{ minHeight: 32, padding: '0 8px' }} onClick={() => setOpen(open === c.card_name ? null : c.card_name)} aria-expanded={open === c.card_name}>
                            {c.card_name}
                          </button>
                        </td>
                        <td className="faint">{c.card_rarity}</td>
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
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {[...d.winners].sort((a, b) => b.count - a.count).slice(0, 15).map((w, i) => (
                  <li key={i} className="row" style={{ minHeight: 30 }}>
                    <span>{w.card}</span>
                    <span className="muted">{w.player}</span>
                    <span className="spacer" />
                    <span className="mono">{w.count}</span>
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
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {[...d.sweepers].sort((a, b) => b.count - a.count).slice(0, 15).map((w, i) => (
                  <li key={i} className="row" style={{ minHeight: 30 }}>
                    <span>{w.card}</span>
                    <span className="muted">{w.player}</span>
                    <span className="spacer" />
                    <span className="mono">{w.count}</span>
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
