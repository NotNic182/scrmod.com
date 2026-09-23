import type { CSSProperties } from 'react'
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
    <span className="chip api-color rank" style={{ '--api-c': c || undefined } as CSSProperties}>
      {label}
    </span>
  )
}
