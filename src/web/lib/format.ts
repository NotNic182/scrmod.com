export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Drops a leading minus from a toFixed() string that rounded to zero (toFixed keeps the sign of values in (-1, 0)). */
function unsignZero(fixed: string): string {
  return Number(fixed) === 0 ? fixed.replace(/^-/, '') : fixed
}

export function pct(fraction: number | null | undefined, digits = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '–'
  return `${unsignZero((fraction * 100).toFixed(digits))}%`
}

export function signed(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  const fixed = unsignZero(n.toFixed(digits))
  return n > 0 && Number(fixed) !== 0 ? `+${fixed}` : fixed
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const label = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return d.getUTCFullYear() === new Date(now).getUTCFullYear() ? label : `${label}, ${d.getUTCFullYear()}`
}

export function clock(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  return n.toLocaleString('en-US')
}

export function goldText(gold: number | null | undefined, hidden: boolean): string {
  if (hidden || gold === -1) return 'hidden'
  if (gold === null || gold === undefined) return '–'
  return `${num(gold)}g`
}

/** Minutes-since as "5m ago" / "2h ago" / "3d ago", for endpoints that give minutes directly. */
export function agoFromMinutes(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return ''
  const mins = Math.max(0, Math.round(m))
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
