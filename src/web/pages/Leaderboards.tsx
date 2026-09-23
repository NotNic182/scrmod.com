import { useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useParams } from 'react-router'
import type { FfaLeaderboardEntry, LeaderboardEntry, OvtLeaderboardEntry, TeamLeaderboardEntry } from '../../shared/api-types'
import { useLeaderboard, useMeta } from '../api/hooks'
import type { AnyBoard } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { PlayerLink } from '../components/PlayerLink'
import { QueryState } from '../components/QueryState'
import { RankChip } from '../components/RankChip'
import { useKeepActiveInView } from '../components/Tabs'
import { Icon } from '../components/Icon'
import { useIdentity } from '../lib/identity'
import { useTitle } from '../lib/title'
import { goldText, pct, plural } from '../lib/format'

const PAGE = 50

const MODES: Array<{ id: string; label: string }> = [
  { id: '1v1', label: '1v1' },
  { id: '2v2', label: '2v2' },
  { id: 'ffa', label: 'FFA' },
  { id: '1v2', label: '1v2' },
  { id: '1v2-solo', label: '1v2 solo' },
  { id: '1v2-duo', label: '1v2 duo' },
]

type Row = LeaderboardEntry | TeamLeaderboardEntry | FfaLeaderboardEntry | OvtLeaderboardEntry

interface Col {
  key: string
  label: string
  num?: boolean
  cell: (r: Row) => ReactNode
}

function colsFor(mode: string, tiers: Parameters<typeof RankChip>[0]['tiers']): Col[] {
  const rating: Col = { key: 'rating', label: 'Rating', num: true, cell: (r) => <strong className="tnum">{'rating' in r ? Math.round(r.rating) : '–'}</strong> }
  const level: Col = { key: 'level', label: 'Lvl', num: true, cell: (r) => r.level }
  if (mode === '2v2') {
    return [
      rating,
      { key: 'series', label: 'Series', num: true, cell: (r) => (r as TeamLeaderboardEntry).completed_series },
      { key: 'wl', label: 'W-L', num: true, cell: (r) => `${(r as TeamLeaderboardEntry).series_wins}-${(r as TeamLeaderboardEntry).series_losses}` },
      { key: 'wr', label: 'Win %', num: true, cell: (r) => pct((r as TeamLeaderboardEntry).win_rate) },
      { key: 'peak', label: 'Peak', num: true, cell: (r) => Math.round((r as TeamLeaderboardEntry).peak_rating) },
      level,
    ]
  }
  if (mode === 'ffa') {
    const f = (r: Row) => r as FfaLeaderboardEntry
    return [
      rating,
      { key: 'games', label: 'Games', num: true, cell: (r) => f(r).games_played },
      { key: 'wins', label: 'Wins', num: true, cell: (r) => f(r).wins },
      { key: 'top3', label: 'Top 3', num: true, cell: (r) => f(r).top3 },
      { key: 'avg', label: 'Avg place', num: true, cell: (r) => f(r).avg_placement?.toFixed(2) ?? '–' },
      { key: 'wr', label: 'Win %', num: true, cell: (r) => pct(f(r).win_rate) },
      level,
    ]
  }
  if (mode.startsWith('1v2')) {
    const o = (r: Row) => r as OvtLeaderboardEntry
    return [
      { key: 'games', label: 'Games', num: true, cell: (r) => o(r).games_played },
      { key: 'wl', label: 'W-L', num: true, cell: (r) => `${o(r).wins}-${o(r).losses}` },
      { key: 'wr', label: 'Win %', num: true, cell: (r) => (o(r).win_rate === undefined ? '–' : `${Math.round(o(r).win_rate)}%`) },
      { key: 'solo', label: 'Solo W-L', num: true, cell: (r) => `${o(r).solo_wins}-${o(r).solo_losses}` },
      { key: 'duo', label: 'Duo W-L', num: true, cell: (r) => `${o(r).duo_wins}-${o(r).duo_losses}` },
      level,
    ]
  }
  const l = (r: Row) => r as LeaderboardEntry
  return [
    rating,
    { key: 'tier', label: 'Tier', cell: (r) => <RankChip name={l(r).rank_name} color={l(r).rank_color} rating={l(r).rating} tiers={tiers} /> },
    { key: 'wl', label: 'W-L', num: true, cell: (r) => `${l(r).wins}-${l(r).losses}` },
    { key: 'wr', label: 'Win %', num: true, cell: (r) => pct(l(r).win_rate) },
    { key: 'games', label: 'Series', num: true, cell: (r) => l(r).total_matches },
    level,
    { key: 'gold', label: 'Gold', num: true, cell: (r) => goldText(l(r).gold, false) },
  ]
}

export function Leaderboards() {
  const { mode = '1v1' } = useParams()
  const [inactive, setInactive] = useState(false)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const q = useLeaderboard(mode, inactive)
  const meta = useMeta()
  const id = useIdentity()
  useTitle(`${MODES.find((m) => m.id === mode)?.label ?? mode} leaderboard`)
  const cols = useMemo(() => colsFor(mode, meta.data?.data.rank_tiers), [mode, meta.data])
  const modes = useRef<HTMLElement>(null)
  useKeepActiveInView(modes, '[aria-current="page"]', mode)

  return (
    <>
      <h1>Leaderboards</h1>
      <nav className="tabs" aria-label="Leaderboard mode" ref={modes}>
        {MODES.map((m) => (
          <NavLink key={m.id} to={`/leaderboards/${m.id}`} onClick={() => { setPage(0); setFilter('') }}>
            {m.label}
          </NavLink>
        ))}
      </nav>
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" type="search" role="searchbox" aria-label="Filter by name" placeholder="Filter by name" maxLength={64} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }} style={{ maxWidth: 320 }} />
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={inactive} onChange={(e) => { setInactive(e.target.checked); setPage(0) }} /> show inactive (90+ days)
        </label>
      </div>
      <div className="card">
        <QueryState q={q} label="leaderboard">
          {(board: AnyBoard) => {
            const all = (board.entries as Row[]) ?? []
            const needle = filter.trim().toLowerCase()
            const rows = needle ? all.filter((r) => r.display_name.toLowerCase().includes(needle)) : all
            const pages = Math.max(1, Math.ceil(rows.length / PAGE))
            // A refresh can shrink the board under the current page; fall back to the last page that exists.
            const at = Math.min(page, pages - 1)
            const slice = rows.slice(at * PAGE, at * PAGE + PAGE)
            return (
              <>
                <div className="row muted" style={{ marginBottom: 6 }}>
                  <span>{plural(board.total_players, 'player')} ranked</span>
                  <span className="spacer" />
                  {pages > 1 ? (
                    <span className="row">
                      <button className="btn icon-btn" disabled={at === 0} onClick={() => setPage(at - 1)} aria-label="Previous page"><span className="rot-prev"><Icon name="chevron" size={18} /></span></button>
                      <span>
                        <span className="sr-only">Page </span>
                        {at + 1} / {pages}
                      </span>
                      <button className="btn icon-btn" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} aria-label="Next page"><span className="rot-next"><Icon name="chevron" size={18} /></span></button>
                    </span>
                  ) : null}
                </div>
                {needle && rows.length === 0 ? <EmptyState title={`No player on this board matches “${filter.trim()}”.`} hint={inactive ? undefined : 'Players inactive for 90+ days are hidden; tick “show inactive” to include them.'} /> : null}
                <div className="table-wrap" hidden={needle !== '' && rows.length === 0}>
                  <table className="t">
                    <thead>
                      <tr>
                        <th className="num stick-rank">#</th>
                        <th className="stick-name">Player</th>
                        {cols.map((c) => (
                          <th key={c.key} className={c.num ? 'num' : undefined}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slice.map((r) => (
                        <tr key={r.steam_id} className={id.me?.steam_id === r.steam_id ? 'me' : undefined}>
                          <td className={`num tnum stick-rank${r.rank <= 3 ? ` medal-${r.rank}` : ''}`}>{r.rank}</td>
                          <td className="stick-name">
                            <PlayerLink steamId={r.steam_id} name={r.display_name} title={r.title} titleColor={r.title_color} online={r.is_online} me={id.me?.steam_id === r.steam_id} />
                            {r.inactive ? <span className="chip faint">inactive</span> : null}
                          </td>
                          {cols.map((c) => (
                            <td key={c.key} className={c.num ? 'num' : undefined}>
                              {c.cell(r)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          }}
        </QueryState>
      </div>
    </>
  )
}
