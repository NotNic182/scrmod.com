import type { FormEntry } from '../../shared/api-types'

export function FormStrip({ form, max = 20 }: { form: FormEntry[] | undefined; max?: number }) {
  const items = (form ?? []).slice(0, max)
  if (!items.length) return <span className="faint">no recent games</span>
  const wins = items.filter((f) => f.result === 'W').length
  return (
    <div className="form-overview">
      <span className="form-strip" role="group" aria-label={`Recent form, newest first: ${wins} won, ${items.length - wins} lost`}>
        {items.map((f, i) => (
          <span key={i} className={`form-w ${f.result === 'W' ? 'w' : 'l'}`}>
            {f.result}
          </span>
        ))}
      </span>
      <details className="form-details">
        <summary>Match details</summary>
        <ol className="plain-list" aria-label="Recent matches, newest first">
          {items.map((f, i) => (
            <li key={i}>
              <strong className={f.result === 'W' ? 'good' : 'bad'}>{f.result === 'W' ? 'Won' : 'Lost'}</strong>
              <span className="tnum">{f.score}</span>
              <span>vs <bdi>{f.opponent}</bdi></span>
              <span className="muted">{f.ranked ? 'ranked' : 'casual'}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
