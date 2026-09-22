export function StatTile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className={`value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  )
}
