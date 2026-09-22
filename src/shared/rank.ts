export interface RankTier {
  floor: number
  name: string
  color: string
}

// Captured from GET /api/v1/rank-tiers on 2026-09-22. The server is the source of truth;
// this is only used before /api/meta has loaded or if it fails.
export const FALLBACK_TIERS: RankTier[] = [
  { floor: 2330, name: 'Grand Master', color: '#F487A9' },
  { floor: 1980, name: 'Master', color: '#55D846' },
  { floor: 1675, name: 'Advanced', color: '#77A3FC' },
  { floor: 1500, name: 'Intermediate', color: '#FDC777' },
  { floor: 0, name: 'Beginner', color: '#BB79EE' },
]

export function tierFor(rating: number, tiers: RankTier[]): RankTier {
  // A degenerate list still has to produce a tier: the return type promises one.
  const sorted = [...(tiers.length ? tiers : FALLBACK_TIERS)].sort((a, b) => b.floor - a.floor)
  const r = Number.isFinite(rating) ? rating : 0
  return sorted.find((t) => r >= t.floor) ?? sorted[sorted.length - 1]
}
