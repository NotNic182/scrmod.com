import { describe, it, expect } from 'vitest'
import { agoFromMinutes } from '../../src/web/lib/format'

describe('agoFromMinutes', () => {
  it('rolls minutes over into hours and days', () => {
    expect(agoFromMinutes(0)).toBe('0m ago')
    expect(agoFromMinutes(13)).toBe('13m ago')
    expect(agoFromMinutes(118)).toBe('1h ago')
    expect(agoFromMinutes(1500)).toBe('1d ago')
    expect(agoFromMinutes(null)).toBe('')
    expect(agoFromMinutes(Number.NaN)).toBe('')
  })
})
