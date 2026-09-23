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
    // Axis labels in the site's own face (a canvas can't read CSS variables, so resolve the stack here).
    const font = `500 12px ${getComputedStyle(document.body).fontFamily}`
    const data = showFfa ? uPlot.join([[x1, y1], [x2, y2]]) : ([x1, y1] as uPlot.AlignedData)
    const opts: uPlot.Options = {
      // The card's width, however narrow: a floor here pushed the chart out of its card on 320px phones.
      width: el.clientWidth || 280,
      height: 220,
      // The key under the chart (below) names the lines in the site's own style; uPlot's table legend doesn't.
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      axes: [
        { font, stroke: color('--fg-muted', '#b6cdd2'), grid: { stroke: color('--line', 'rgba(255, 255, 255, 0.09)') }, ticks: { stroke: color('--line', 'rgba(255, 255, 255, 0.09)') } },
        { font, stroke: color('--fg-muted', '#b6cdd2'), grid: { stroke: color('--line', 'rgba(255, 255, 255, 0.09)') }, ticks: { stroke: color('--line', 'rgba(255, 255, 255, 0.09)') }, size: 52 },
      ],
      series: [
        {},
        { label: '1v1', stroke: color('--accent-ink', '#f7a64d'), width: 2, spanGaps: true },
        ...(showFfa ? [{ label: 'FFA', stroke: color('--info', '#92baff'), width: 2, spanGaps: true }] : []),
      ],
    }
    const chart = new uPlot(opts, data, el)
    const ro = new ResizeObserver(() => chart.setSize({ width: el.clientWidth || 280, height: 220 }))
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
  return (
    <>
      <div ref={ref} className="rating-graph" role="img" aria-label={summary} />
      {showFfa ? (
        // Which line is which; the chart's summary above already says it to screen readers.
        <div className="chart-key" aria-hidden="true">
          <span className="key key-1v1">1v1</span>
          <span className="key key-ffa">FFA</span>
        </div>
      ) : null}
    </>
  )
}
