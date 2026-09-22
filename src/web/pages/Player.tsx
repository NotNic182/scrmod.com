import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useMeta, usePlayer } from '../api/hooks'
import type { HubProfile } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { QueryState } from '../components/QueryState'
import { RankChip } from '../components/RankChip'
import { Tabs } from '../components/Tabs'
import { TitleTag } from '../components/TitleTag'
import { useIdentity } from '../lib/identity'
import { relTime } from '../lib/format'
import { NotFound } from './NotFound'
import { Overview } from './player/Overview'
import { Matches } from './player/Matches'
import { TeamHistoryTab } from './player/TeamHistory'
import { FfaHistoryTab } from './player/FfaHistory'
import { OvtHistoryTab } from './player/OvtHistory'
import { AchievementsTab } from './player/Achievements'
import { TournamentsTab } from './player/TournamentsTab'
import { HeadToHead } from './player/HeadToHead'

export const PLAYER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: '1v1 matches' },
  { id: '2v2', label: '2v2' },
  { id: 'ffa', label: 'FFA' },
  { id: '1v2', label: '1v2' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'tournaments', label: 'Tournaments' },
]

const TabBody: Record<string, (props: { p: HubProfile; me: string | null }) => ReactNode> = {
  overview: ({ p }) => <Overview p={p} />,
  matches: ({ p }) => <Matches steamId={p.steam_id} />,
  '2v2': ({ p }) => <TeamHistoryTab steamId={p.steam_id} />,
  ffa: ({ p }) => <FfaHistoryTab steamId={p.steam_id} />,
  '1v2': ({ p }) => <OvtHistoryTab steamId={p.steam_id} />,
  achievements: ({ p }) => <AchievementsTab steamId={p.steam_id} />,
  tournaments: ({ p }) => <TournamentsTab steamId={p.steam_id} />,
  h2h: ({ p, me }) => (me ? <HeadToHead p={p} me={me} /> : <EmptyState title="Pin yourself to compare." />),
}

export function Player() {
  const { steamId } = useParams()
  const [params, setParams] = useSearchParams()
  const id = useIdentity()
  const meta = useMeta()
  const valid = !!steamId && /^\d{17}$/.test(steamId)
  const q = usePlayer(valid ? steamId : undefined, id.me?.steam_id ?? null)
  if (!valid) return <NotFound />

  const isMe = id.me?.steam_id === steamId
  const tabs = isMe || !id.me ? PLAYER_TABS : [...PLAYER_TABS, { id: 'h2h', label: `vs ${id.me.display_name}` }]
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'overview'

  return (
    <QueryState q={q} label="player">
      {(p) => (
        <>
          <header className="card">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ marginBottom: 4 }}>
                  {p.display_name}
                  {isMe ? <span className="faint" style={{ fontSize: 14 }}> (you)</span> : null}
                </h1>
                <div className="row">
                  <RankChip name={p.rank_name} color={p.rank_color} rating={p.rating} tiers={meta.data?.data.rank_tiers} />
                  <TitleTag title={p.active_title} color={p.active_title_color} />
                  {p.show_discord && p.discord_display_name ? <span className="chip" style={{ background: 'var(--bg-elev)' }}>Discord: {p.discord_display_name}</span> : null}
                </div>
                <div className="faint" style={{ marginTop: 6 }}>
                  {p.last_match ? `last match ${relTime(p.last_match)}` : 'no matches yet'}
                  {p.mod_version ? ` · mod v${p.mod_version}` : ''}
                </div>
              </div>
              <span className="spacer" />
              {!isMe ? (
                <button className="btn" onClick={() => id.pin({ steam_id: p.steam_id, display_name: p.display_name })}>
                  This is me
                </button>
              ) : null}
            </div>
          </header>
          <Tabs tabs={tabs} value={tab} onChange={(t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })} />
          {(TabBody[tab] ?? (() => <EmptyState title="Coming soon" />))({ p, me: id.me?.steam_id ?? null })}
        </>
      )}
    </QueryState>
  )
}
