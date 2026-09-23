import type { FormEntry } from '../../shared/api-types'

export function FormStrip({ form, max = 20 }: { form: FormEntry[] | undefined; max?: number }) {
  const items = (form ?? []).slice(0, max)
  if (!items.length) return <span className="faint">no recent games</span>
  const wins = items.filter((f) => f.result === 'W').length
  return (
    <span className="form-strip" role="group" aria-label={`Recent form, newest first: ${wins} won, ${items.length - wins} lost`}>
      {items.map((f, i) => (
        <span key={i} className={`form-w ${f.result === 'W' ? 'w' : 'l'}`} title={`${f.result} ${f.score} vs ${f.opponent}${f.ranked ? ' (ranked)' : ''}`}>
          {f.result}
        </span>
      ))}
    </span>
  )
}
