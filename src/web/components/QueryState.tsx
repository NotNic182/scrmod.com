import type { ReactNode } from 'react'
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
  return "Can't reach the hub. Check your connection."
}

interface Props<T> {
  q: UseQueryResult<Enveloped<T>>
  label: string
  empty?: (data: T) => boolean
  emptyHint?: string
  children: (data: T, meta: { fetched_at: string; stale: boolean; errors: string[] }) => ReactNode
}

export function QueryState<T>({ q, label, empty, emptyHint, children }: Props<T>) {
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
    return <div className="banner bad">{errorText(q.error)}</div>
  }
  const body = q.data!
  if (empty && empty(body.data)) return <EmptyState title={`No ${label} right now.`} hint={emptyHint} />
  return (
    <>
      {q.isError ? <div className="banner bad">{errorText(q.error)}</div> : null}
      {children(body.data, { fetched_at: body.fetched_at, stale: body.stale, errors: body.errors ?? [] })}
      <DataAge fetchedAt={body.fetched_at} stale={body.stale} />
    </>
  )
}
