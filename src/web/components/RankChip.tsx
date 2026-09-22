import { FALLBACK_TIERS, tierFor, type RankTier } from '../../shared/rank'

interface Props {
  name?: string | null
  color?: string | null
  rating?: number | null
  tiers?: RankTier[]
}

export function RankChip({ name, color, rating, tiers }: Props) {
  let label = name ?? ''
  let c = color ?? ''
  if (!label && rating !== null && rating !== undefined) {
    const t = tierFor(rating, tiers?.length ? tiers : FALLBACK_TIERS)
    label = t.name
    c = t.color
  }
  if (!label) return null
  return (
    <span className="chip" style={{ border: `1px solid ${c || 'var(--line)'}`, color: c || 'var(--fg-muted)' }}>
      {label}
    </span>
  )
}
