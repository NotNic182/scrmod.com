import { useEffect, useState } from 'react'
import { useSearch } from '../api/hooks'
import type { PlayerSearchResult } from '../../shared/api-types'

export function SearchBox({ onSelect, placeholder = 'Search players…', autoFocus }: { onSelect: (r: PlayerSearchResult) => void; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), 200)
    return () => clearTimeout(id)
  }, [text])
  const q = useSearch(debounced)
  const results = q.data?.data.results ?? []
  return (
    <div>
      <input className="input" type="search" role="searchbox" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label="Search players" />
      {debounced && (
        <ul role="listbox" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
          {q.isPending ? <li className="faint">Searching…</li> : null}
          {results.map((r) => (
            <li key={r.steam_id}>
              <button role="option" aria-selected={false} className="btn" style={{ width: '100%', justifyContent: 'space-between', marginTop: 4 }} onClick={() => onSelect(r)}>
                <span>{r.display_name}</span>
                <span className="muted mono">{Math.round(r.rating)}</span>
              </button>
            </li>
          ))}
          {q.isSuccess && results.length === 0 ? <li className="faint">No players match.</li> : null}
        </ul>
      )}
    </div>
  )
}
