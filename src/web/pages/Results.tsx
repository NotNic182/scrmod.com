import { useTitle } from '../lib/title'
import { useState } from 'react'
import { useResults, useResults1v1 } from '../api/hooks'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { TabPanel, Tabs } from '../components/Tabs'
import { relTime, signed } from '../lib/format'
import { ResultRow } from './Home'

const TABS = [
  { id: 'all', label: 'All' },
  { id: '1v1', label: '1v1' },
  { id: '2v2', label: '2v2' },
  { id: 'ffa', label: 'FFA' },
  { id: 'ovt', label: '1v2' },
]

export function Results() {
  useTitle('Results')
  const [tab, setTab] = useState('all')
  const feed = useResults(100)
  const series = useResults1v1(50)
  return (
    <>
      <h1>Results</h1>
      <Tabs tabs={TABS} value={tab} onChange={setTab} panelId="results-panel" label="Game mode" />
      <TabPanel id="results-panel" value={tab}>
        <div className="card">
          {tab === '1v1' ? (
            <QueryState q={series} label="ranked series" empty={(d) => !d.series?.length}>
              {(d) => (
                <div className="table-wrap">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Winner</th>
                        <th className="num">Score</th>
                        <th>Loser</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.series.map((s) => {
                        const p1Won = s.winner_steam_id === s.p1_steam_id
                        const w = p1Won ? { id: s.p1_steam_id, name: s.p1_name, r: s.p1_rating, d: s.p1_rating_change, st: s.p1_streak, wins: s.p1_series_wins } : { id: s.p2_steam_id, name: s.p2_name, r: s.p2_rating, d: s.p2_rating_change, st: s.p2_streak, wins: s.p2_series_wins }
                        const l = p1Won ? { id: s.p2_steam_id, name: s.p2_name, r: s.p2_rating, d: s.p2_rating_change, st: s.p2_streak, wins: s.p2_series_wins } : { id: s.p1_steam_id, name: s.p1_name, r: s.p1_rating, d: s.p1_rating_change, st: s.p1_streak, wins: s.p1_series_wins }
                        return (
                          <tr key={s.series_id}>
                            <td>
                              <PlayerLink steamId={w.id} name={w.name} bold /> <span className="muted tnum">{Math.round(w.r)}</span>{' '}
                              <span className="tnum good">{signed(w.d, 1)}</span>
                              {s.tournament ? <span className="chip" style={{ marginLeft: 6 }}>{s.tournament_label || 'tournament'}</span> : null}
                            </td>
                            <td className="num tnum" style={{ fontWeight: 800 }}>
                              {w.wins}–{l.wins}
                            </td>
                            <td>
                              <PlayerLink steamId={l.id} name={l.name} /> <span className="muted tnum">{Math.round(l.r)}</span>{' '}
                              <span className="tnum bad">{signed(l.d, 1)}</span>
                            </td>
                            <td className="faint">
                              {relTime(s.completed_at)}
                              {s.bets?.length ? ` · ${s.bets.length} bet${s.bets.length === 1 ? '' : 's'}` : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </QueryState>
          ) : (
            <QueryState q={feed} label="results" empty={(d) => !d.entries?.length}>
              {(d) => {
                const rows = tab === 'all' ? d.entries : d.entries.filter((e) => e.mode === tab)
                if (!rows.length) return <div className="empty">No recent {TABS.find((t) => t.id === tab)?.label} results.</div>
                return (
                  <div className="table-wrap">
                    <table className="t">
                      <tbody>
                        {rows.map((e) => (
                          <ResultRow key={`${e.mode}-${e.id}`} e={e} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }}
            </QueryState>
          )}
        </div>
      </TabPanel>
    </>
  )
}
