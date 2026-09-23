import { useRef, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { HubError } from '../api/client'
import { DataAge } from './DataAge'
import { EmptyState } from './EmptyState'

export interface Enveloped<T> {
  data: T
  fetched_at: string
  stale: boolean
  errors?: string[]
}

export function errorText(err: unknown): string {
  if (err instanceof HubError) {
    const code = (err.body as { error?: string } | null)?.error
    if (err.status === 404) return 'Not found.'
    if (err.status === 429) return 'Too many requests from your connection. Slow down a little.'
    if (code === 'upstream_version_gate') return 'The site needs an update to talk to the new server version.'
    if (code === 'upstream_rate_limited') return "Sid's server is busy. Retrying shortly."
    if (err.status === 503 || err.status === 502) return "Sid's server isn't responding. Showing what we have."
    return `Something went wrong (${err.status}).`
  }
  return "Can't reach SCRmod. Check your connection."
}

interface Props<T> {
  q: UseQueryResult<Enveloped<T>>
  label: string
  empty?: (data: T) => boolean
  emptyHint?: string
  children: (data: T, meta: { fetched_at: string; stale: boolean; errors: string[] }) => ReactNode
}

/**
 * Error banner with a way out: 404s and rate limits don't get a retry (retrying can't help or makes it worse).
 * While a retry runs the button stays in place and focusable (aria-disabled, not disabled), so a keyboard user
 * pressing it isn't dropped back to the top of the page.
 */
function ErrorBanner({ q, error, label }: { q: UseQueryResult<unknown>; error: unknown; label: string }) {
  const status = error instanceof HubError ? error.status : 0
  const retryable = status !== 404 && status !== 429
  const busy = q.isFetching
  return (
    <div className="banner bad row" role="alert">
      <span>{status === 404 ? `${label[0].toUpperCase()}${label.slice(1)} not found. The link may be old, or the data was deleted.` : errorText(error)}</span>
      {retryable ? (
        <>
          <span className="spacer" />
          <button className="btn btn-sm" aria-disabled={busy || undefined} onClick={() => (busy ? undefined : void q.refetch())}>
            {busy ? 'Retrying…' : 'Try again'}
          </button>
        </>
      ) : null}
    </div>
  )
}

export function QueryState<T>({ q, label, empty, emptyHint, children }: Props<T>) {
  // React Query clears the error when a retry starts on a query that has no data yet; keep showing it (and the
  // button that was pressed) until the retry settles, instead of swapping in the loading placeholder.
  const lastError = useRef<unknown>(null)
  if (q.error) lastError.current = q.error
  // Opened while offline: React Query parks the request instead of failing it, so say so instead of shimmering forever.
  if (q.isPending && q.fetchStatus === 'paused') {
    return <EmptyState title={`Can't load ${label} while you're offline.`} hint="It will load by itself when your connection comes back." />
  }
  if (q.isPending && q.errorUpdateCount > 0 && lastError.current) {
    return <ErrorBanner q={q} error={lastError.current} label={label} />
  }
  if (q.isPending) {
    return (
      <div aria-busy="true">
        <span className="faint">Loading {label}…</span>
        <div className="skeleton" style={{ width: '70%' }} />
        <div className="skeleton" style={{ width: '90%' }} />
        <div className="skeleton" style={{ width: '60%' }} />
      </div>
    )
  }
  if (q.isError && !q.data) {
    return <ErrorBanner q={q} error={q.error} label={label} />
  }
  const body = q.data!
  if (empty && empty(body.data)) return <EmptyState title={`No ${label} right now.`} hint={emptyHint} />
  return (
    <>
      {q.isError ? <ErrorBanner q={q} error={q.error} label={label} /> : null}
      {children(body.data, { fetched_at: body.fetched_at, stale: body.stale, errors: body.errors ?? [] })}
      <DataAge fetchedAt={body.fetched_at} stale={body.stale} />
    </>
  )
}
