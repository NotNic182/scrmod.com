import { describe, it, expect } from 'vitest'
import { tierFor, FALLBACK_TIERS, type RankTier } from '../../src/shared/rank'

describe('tierFor', () => {
  it('returns the highest tier whose floor is at or below the rating', () => {
    expect(tierFor(2564, FALLBACK_TIERS).name).toBe('Grand Master')
    expect(tierFor(1980, FALLBACK_TIERS).name).toBe('Master')
    expect(tierFor(1979, FALLBACK_TIERS).name).toBe('Advanced')
    expect(tierFor(0, FALLBACK_TIERS).name).toBe('Beginner')
  })

  it('does not depend on the input order', () => {
    const shuffled: RankTier[] = [...FALLBACK_TIERS].reverse()
    expect(tierFor(1700, shuffled).name).toBe('Advanced')
  })

  it('falls back to the lowest tier for a negative or NaN rating', () => {
    expect(tierFor(-5, FALLBACK_TIERS).name).toBe('Beginner')
    expect(tierFor(Number.NaN, FALLBACK_TIERS).name).toBe('Beginner')
  })
})
