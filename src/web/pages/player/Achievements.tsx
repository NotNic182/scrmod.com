import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { fmtDate } from '../../lib/format'

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
              <div className="muted" style={{ marginBottom: 8 }}>
                {n} of {sorted.length} unlocked
              </div>
              <div className="tiles">
                {sorted.map((a) => (
                  <div key={a.achievement_key} className="tile" style={{ opacity: a.unlocked ? 1 : 0.55 }}>
                    <div className="value" style={{ fontSize: 15 }}>
                      {a.unlocked ? '✓ ' : ''}
                      {a.name}
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
