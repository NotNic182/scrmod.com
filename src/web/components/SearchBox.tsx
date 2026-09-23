import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useSearch } from '../api/hooks'
import { plural } from '../lib/format'
import type { PlayerSearchResult } from '../../shared/api-types'

/**
 * Player search as an ARIA combobox: focus stays in the input, ↑/↓ move through results, Enter picks,
 * Escape clears (a second Escape, on an empty field, is left to the surrounding panel to close it).
 */
export function SearchBox({ onSelect, placeholder = 'Search players…', autoFocus }: { onSelect: (r: PlayerSearchResult) => void; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text.trim()), 200)
    return () => clearTimeout(id)
  }, [text])
  const q = useSearch(debounced)
  const results = q.data?.data.results ?? []
  const open = debounced.length > 0 && results.length > 0
  const optionId = (i: number) => `${listId}-opt-${i}`

  // New results: nothing highlighted until the user arrows in, so a stray Enter can't pin the wrong person.
  useEffect(() => setActive(-1), [q.data])

  const status = !debounced
    ? ''
    : q.isError
      ? "Search isn't available right now. Try again in a moment."
      : q.isPending
        ? 'Searching…'
        : results.length
          ? `${plural(results.length, 'player')} found. Use the arrow keys to choose.`
          : 'No players match.'

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a + step + results.length + (a === -1 && step === -1 ? 1 : 0)) % results.length)
    } else if (e.key === 'Enter') {
      const pick = results[active] ?? (results.length === 1 ? results[0] : undefined)
      if (pick) {
        e.preventDefault()
        onSelect(pick)
      }
    } else if (e.key === 'Escape' && text) {
      // Clear first; only an Escape on an empty field reaches the panel's close handler.
      e.stopPropagation()
      setText('')
      setDebounced('')
    }
  }

  return (
    <div className="searchbox">
      <input
        ref={input}
        className="input"
        type="search"
        role="combobox"
        aria-label="Search players"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        value={text}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <ul id={listId} role="listbox" aria-label="Matching players" className="search-results" hidden={!open}>
        {results.map((r, i) => (
          <li
            key={r.steam_id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className="search-option"
            // mousedown would blur the input first; keep focus where the keyboard user left it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(r)}
            onMouseMove={() => setActive(i)}
          >
            <bdi className="truncate">{r.display_name}</bdi>
            <span className="muted tnum">{Math.round(r.rating)}</span>
          </li>
        ))}
      </ul>
      <div className={debounced && !open ? 'search-status faint' : 'sr-only'} role="status">
        {status}
      </div>
      {q.isError && debounced ? (
        // The button goes away as soon as the retry starts; focus returns to the field the user was typing in.
        <button
          className="btn btn-sm trailing"
          onClick={() => {
            input.current?.focus()
            void q.refetch()
          }}
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}
