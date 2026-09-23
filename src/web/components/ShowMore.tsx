import { useState } from 'react'

/**
 * The first `n` items of a long list, plus the button that shows the rest (and folds them away again). The button
 * stays put and keeps focus either way; it isn't rendered when the list is short. Call it from a component that
 * always renders, not inside a QueryState callback.
 */
export function useFirst<T>(list: T[], n: number, controls?: string) {
  const [all, setAll] = useState(false)
  const long = list.length > n
  const items = all || !long ? list : list.slice(0, n)
  const button = long ? (
    <button type="button" className="btn btn-sm show-more" aria-expanded={all} aria-controls={controls} onClick={() => setAll((a) => !a)}>
      {all ? 'Show fewer' : `Show all ${list.length}`}
    </button>
  ) : null
  return { items, button }
}
