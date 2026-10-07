import { afterEach, describe, expect, it, vi } from 'vitest'
import { lazy, Suspense } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@tanstack/react-query'
import { Route, Routes } from 'react-router'
import { renderApp } from './helpers/render'
import { env, mockHub } from './helpers/mockHub'
import { hubGet } from '../../src/web/api/client'
import { ErrorBoundary } from '../../src/web/components/ErrorBoundary'
import { Layout } from '../../src/web/components/Layout'
import { QueryState } from '../../src/web/components/QueryState'
import * as pageLoad from '../../src/web/lib/pageLoadError'

afterEach(() => vi.restoreAllMocks())

describe('page recovery', () => {
  it('offers a real reload for a cached rejected lazy page instead of repeating the failed render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reload = vi.spyOn(pageLoad, 'reloadPage').mockImplementation(() => undefined)
    const load = vi.fn(() => Promise.reject(new pageLoad.PageLoadError(new Error('chunk unavailable'))))
    const Page = lazy(load)
    renderApp(<ErrorBoundary><Suspense fallback={<p>Loading page</p>}><Page /></Suspense></ErrorBoundary>)
    const button = await screen.findByRole('button', { name: 'Reload page' })
    expect(screen.getByRole('alert')).toHaveTextContent("This page couldn't load")
    await userEvent.click(button)
    expect(reload).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('refetches cached data that crashed the page before retrying the render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let malformed = true
    const { calls } = mockHub({ '/widget': () => new Response(JSON.stringify(env({ name: malformed ? null : 'Recovered' }))) })
    function Page() {
      const q = useQuery({ queryKey: ['widget'], queryFn: () => hubGet<{ data: { name: string }; fetched_at: string; stale: boolean }>('/widget') })
      return <QueryState q={q} label="widget">{(d) => <p>{d.name.toUpperCase()}</p>}</QueryState>
    }
    renderApp(<Routes><Route element={<Layout />}><Route index element={<Page />} /></Route></Routes>)
    const retry = await screen.findByRole('button', { name: 'Try again' })
    malformed = false
    await userEvent.click(retry)
    expect(await screen.findByText('RECOVERED')).toBeInTheDocument()
    expect(calls.filter((p) => p === '/widget')).toHaveLength(2)
    expect(screen.getByRole('main')).toHaveFocus()
  })
})
