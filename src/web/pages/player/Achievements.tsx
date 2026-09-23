import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate } from '../../lib/format'
import { Icon } from '../../components/Icon'

export function AchievementsTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'achievements')
  return (
    <div className="card">
      <QueryState q={q} label="achievements" empty={(d) => !d.achievements?.length}>
        {(d) => {
          const sorted = [...d.achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? ''))
          const n = sorted.filter((a) => a.unlocked).length
          return (
            <>
              <div className="muted intro">
                {n} of {sorted.length} unlocked
              </div>
              <div className="tiles ach">
                {sorted.map((a) => (
                  <div key={a.achievement_key} className={`tile ${a.unlocked ? 'earned' : 'locked'}`}>
                    <div className="value ach-name">
                      {a.unlocked ? <Icon name="check" size={16} /> : null}
                      {a.name}
                      {a.unlocked ? <span className="sr-only"> (unlocked)</span> : null}
                    </div>
                    <div className="sub">
                      {a.gold}g · {a.global_pct}% of players
                    </div>
                    {a.unlocked_at ? <div className="faint">{fmtDate(a.unlocked_at)}</div> : null}
                  </div>
                ))}
              </div>
            </>
          )
        }}
      </QueryState>
    </div>
  )
}
