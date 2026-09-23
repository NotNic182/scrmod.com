import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { FfaRatingPoint, RatingPoint } from '../../shared/api-types'
import { useAppliedTheme } from '../lib/theme'

function series(points: Array<{ date: string; rating: number }> | undefined): [number[], number[]] {
  const xs: number[] = []
  const ys: number[] = []
  for (const p of points ?? []) {
    const t = Date.parse(p.date) / 1000
    if (Number.isFinite(t) && Number.isFinite(p.rating)) {
      xs.push(t)
      ys.push(p.rating)
    }
  }
  return [xs, ys]
}

/** Rating over time. 1v1 in brand gold ink, redrawn on a theme switch, FFA (optional) in the info color. */
export function RatingGraph({ history, ffa }: { history: RatingPoint[] | undefined; ffa?: FfaRatingPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [x1, y1] = series(history)
  const [x2, y2] = series(ffa)
  const showFfa = x2.length >= 2
  const theme = useAppliedTheme()

  useEffect(() => {
    const el = ref.current
    if (!el || x1.length < 2) return
    const css = getComputedStyle(document.documentElement)
    const color = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback
    const data = showFfa ? uPlot.join([[x1, y1], [x2, y2]]) : ([x1, y1] as uPlot.AlignedData)
    const opts: uPlot.Options = {
      width: Math.max(280, el.clientWidth),
      height: 220,
      legend: { show: showFfa },
      cursor: { drag: { x: false, y: false } },
      axes: [
        { stroke: color('--fg-muted', '#999'), grid: { stroke: color('--line', '#2a3042') } },
        { stroke: color('--fg-muted', '#999'), grid: { stroke: color('--line', '#2a3042') }, size: 52 },
      ],
      series: [
        {},
        { label: '1v1', stroke: color('--accent-ink', '#ffcc33'), width: 2, spanGaps: true },
        ...(showFfa ? [{ label: 'FFA', stroke: color('--info', '#77a3fc'), width: 2, spanGaps: true }] : []),
      ],
    }
    const chart = new uPlot(opts, data, el)
    const ro = new ResizeObserver(() => chart.setSize({ width: Math.max(280, el.clientWidth), height: 220 }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      chart.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, ffa, theme])

  if (x1.length < 2) return <div className="empty">Not enough rated games for a graph yet.</div>
  // The canvas says nothing to a screen reader: give it the story the line tells.
  const summary = `1v1 rating over ${x1.length} rated games: from ${Math.round(y1[0])} to ${Math.round(y1[y1.length - 1])}, highest ${Math.round(Math.max(...y1))}, lowest ${Math.round(Math.min(...y1))}.${showFfa ? ` FFA rating now ${Math.round(y2[y2.length - 1])}.` : ''}`
  return <div ref={ref} style={{ width: '100%' }} role="img" aria-label={summary} />
}
