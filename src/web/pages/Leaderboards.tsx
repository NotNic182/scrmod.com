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
import { BOARD_MODES, INTROS, pageMeta } from '../../shared/seo'

const PAGE = 50

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

/**
 * Previous / page / next. At the first or last page the buttons stay focusable (aria-disabled, not disabled), so
 * keyboard focus isn't thrown out of the pager; only the top pager announces the page, so it isn't read twice.
 */
function Pager({ at, pages, onPage, live }: { at: number; pages: number; onPage: (n: number) => void; live?: boolean }) {
  return (
    <span className="row">
      <button className="btn icon-btn" aria-disabled={at === 0 || undefined} onClick={() => at > 0 && onPage(at - 1)} aria-label="Previous page">
        <span className="rot-prev">
          <Icon name="chevron" size={18} />
        </span>
      </button>
      <span aria-live={live ? 'polite' : undefined}>
        <span className="sr-only">Page </span>
        {at + 1} / {pages}
      </span>
      <button className="btn icon-btn" aria-disabled={at >= pages - 1 || undefined} onClick={() => at < pages - 1 && onPage(at + 1)} aria-label="Next page">
        <span className="rot-next">
          <Icon name="chevron" size={18} />
        </span>
      </button>
    </span>
  )
}

export function Leaderboards() {
  const { mode = '1v1' } = useParams()
  const [inactive, setInactive] = useState(false)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const q = useLeaderboard(mode, inactive)
  const meta = useMeta()
  const id = useIdentity()
  useTitle(pageMeta({ kind: 'leaderboard', mode }).title)
  const cols = useMemo(() => colsFor(mode, meta.data?.data.rank_tiers), [mode, meta.data])
  const modes = useRef<HTMLElement>(null)
  const boardCard = useRef<HTMLDivElement>(null)
  useKeepActiveInView(modes, '[aria-current="page"]', mode)

  const board = q.data?.data as AnyBoard | undefined
  const all = (board?.entries as Row[] | undefined) ?? []
  const needle = filter.trim().toLowerCase()
  const rows = needle ? all.filter((r) => (r.display_name ?? '').toLowerCase().includes(needle)) : all
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  // A refresh can shrink the board under the current page; fall back to the last page that exists.
  const at = Math.min(page, pages - 1)
  const slice = rows.slice(at * PAGE, at * PAGE + PAGE)
  // The pager under the table brings the new page's first row into view; the one on top already is.
  const toPage = (n: number, fromBottom: boolean) => {
    setPage(n)
    if (fromBottom) boardCard.current?.scrollIntoView?.({ block: 'start' })
  }

  return (
    <>
      <h1>Leaderboards</h1>
      <p className="page-intro">{BOARD_MODES.find((m) => m.id === mode)?.ranked === false ? INTROS.leaderboards1v2 : INTROS.leaderboards}</p>
      <nav className="tabs" aria-label="Leaderboard mode" ref={modes}>
        {BOARD_MODES.map((m) => (
          <NavLink key={m.id} to={`/leaderboards/${m.id}`} onClick={() => { setPage(0); setFilter('') }}>
            {m.label}
          </NavLink>
        ))}
      </nav>
      {/* Everything that acts on the board sits in one bar on the board: the name filter, inactive players, the count and the pages. */}
      <div className="card board" ref={boardCard}>
        <div className="toolbar">
          <input className="input filter" type="search" role="searchbox" aria-label="Filter by name" placeholder="Filter by name" maxLength={64} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }} />
          <label className="row check">
            <input type="checkbox" checked={inactive} onChange={(e) => { setInactive(e.target.checked); setPage(0) }} /> show inactive (90+ days)
          </label>
          <span className="spacer" />
          {board ? <span className="muted">{plural(board.total_players, 'player')} ranked</span> : null}
          {pages > 1 ? <Pager at={at} pages={pages} onPage={(n) => toPage(n, false)} live /> : null}
        </div>
        <QueryState q={q} label="leaderboard">
          {() => (
            <>
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
              {pages > 1 ? (
                <div className="pager-bottom">
                  <Pager at={at} pages={pages} onPage={(n) => toPage(n, true)} />
                </div>
              ) : null}
            </>
          )}
        </QueryState>
      </div>
    </>
  )
}
