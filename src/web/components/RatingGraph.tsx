import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { FfaRatingPoint, RatingPoint } from '../../shared/api-types'

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

/** Rating over time. 1v1 in the accent color, FFA (optional) in the info color. */
export function RatingGraph({ history, ffa }: { history: RatingPoint[] | undefined; ffa?: FfaRatingPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [x1, y1] = series(history)
  const [x2, y2] = series(ffa)
  const showFfa = x2.length >= 2

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
        { stroke: color('--fg-muted', '#999'), grid: { stroke: 'rgba(128,128,128,0.15)' } },
        { stroke: color('--fg-muted', '#999'), grid: { stroke: 'rgba(128,128,128,0.15)' }, size: 52 },
      ],
      series: [
        {},
        { label: '1v1', stroke: color('--accent', '#ffcc33'), width: 2, spanGaps: true },
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
  }, [history, ffa])

  if (x1.length < 2) return <div className="empty">Not enough rated games for a graph yet.</div>
  return <div ref={ref} style={{ width: '100%' }} aria-label="Rating over time" />
}
