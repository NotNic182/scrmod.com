import { describe, it, expect } from 'vitest'
import { relTime, pct, signed, fmtDate, clock, num, goldText } from '../../src/web/lib/format'

const NOW = Date.parse('2026-09-22T12:00:00Z')

describe('format', () => {
  it('relTime', () => {
    expect(relTime('2026-09-22T11:59:58Z', NOW)).toBe('just now')
    expect(relTime('2026-09-22T11:59:20Z', NOW)).toBe('40s ago')
    expect(relTime('2026-09-22T11:47:00Z', NOW)).toBe('13m ago')
    expect(relTime('2026-09-22T09:00:00Z', NOW)).toBe('3h ago')
    expect(relTime('2026-09-19T12:00:00Z', NOW)).toBe('3d ago')
    expect(relTime(null, NOW)).toBe('')
    expect(relTime('garbage', NOW)).toBe('')
  })
  it('pct and signed', () => {
    expect(pct(0.4935)).toBe('49%')
    expect(pct(0.9877, 1)).toBe('98.8%')
    expect(pct(undefined)).toBe('–')
    expect(signed(8.9, 1)).toBe('+8.9')
    expect(signed(-110.2)).toBe('-110')
    expect(signed(0)).toBe('0')
    expect(signed(null)).toBe('–')
    expect(signed(-0.4)).toBe('0')
    expect(signed(-0.04, 1)).toBe('0.0')
    expect(signed(0.04, 1)).toBe('0.0')
    expect(pct(-0.0001)).toBe('0%')
  })
  it('fmtDate, clock, num, goldText', () => {
    expect(fmtDate('2026-09-21T07:17:22Z', NOW)).toBe('Sep 21')
    expect(fmtDate('2025-12-01T00:00:00Z', NOW)).toBe('Dec 1, 2025')
    expect(clock(281)).toBe('4:41')
    expect(clock(0)).toBe('0:00')
    expect(num(31818)).toBe('31,818')
    expect(goldText(31818, false)).toBe('31,818g')
    expect(goldText(-1, false)).toBe('hidden')
    expect(goldText(5, true)).toBe('hidden')
    expect(goldText(undefined, false)).toBe('–')
  })
})
