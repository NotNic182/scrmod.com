import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@tanstack/react-query'
import { renderApp } from './helpers/render'
import { mockHub, env, jsonResponse } from './helpers/mockHub'
import { Tabs, TabPanel } from '../../src/web/components/Tabs'
import { SearchBox } from '../../src/web/components/SearchBox'
import { QueryState } from '../../src/web/components/QueryState'
import { ErrorBoundary } from '../../src/web/components/ErrorBoundary'
import { IdentityMenu } from '../../src/web/components/IdentityMenu'
import { hubGet } from '../../src/web/api/client'
import { plural } from '../../src/web/lib/format'

const TABS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

function TabsHarness() {
  const [v, setV] = useState('a')
  return (
    <>
      <Tabs tabs={TABS} value={v} onChange={setV} panelId="p" label="Letters" />
      <TabPanel id="p" value={v}>
        panel {v}
      </TabPanel>
    </>
  )
}

describe('hardening', () => {
  beforeEach(() => localStorage.clear())

  it('tabs: one Tab stop, arrows/Home/End move and wrap, panel is labelled by the selected tab', async () => {
    renderApp(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1])
    tabs[0].focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Alpha' })).toHaveTextContent('panel a')
  })

  it('search: arrow keys highlight a result and Enter picks it; the count is announced', async () => {
    mockHub({
      '/players/search?q=ni': env({
        results: [
          { steam_id: '1', display_name: 'Nice', rating: 1500 },
          { steam_id: '2', display_name: 'NotNic', rating: 1101 },
        ],
      }),
    })
    const onSelect = vi.fn()
    renderApp(<SearchBox onSelect={onSelect} />)
    const box = screen.getByRole('combobox')
    await userEvent.type(box, 'ni')
    await screen.findByRole('option', { name: /NotNic/ })
    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('2 players found')
    // Enter with nothing highlighted and two results picks nobody.
    await userEvent.keyboard('{Enter}')
    expect(onSelect).not.toHaveBeenCalled()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(box.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: /NotNic/ }).id)
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ steam_id: '2' }))
  })

  it('identity panel: Escape clears the search first, a second Escape closes the panel and returns focus', async () => {
    mockHub({ '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(<IdentityMenu />)
    const trigger = await screen.findByRole('button', { name: /find me/i })
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.type(screen.getByRole('combobox'), 'zz')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('combobox')).toHaveValue('')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('query errors offer a retry that recovers; 404s explain instead of retrying', async () => {
    let fail = true
    mockHub({ '/flaky': () => (fail ? jsonResponse({ error: 'boom' }, 500) : jsonResponse(env({ n: 7 }))) })
    function Flaky() {
      const q = useQuery({ queryKey: ['flaky'], queryFn: () => hubGet<{ data: { n: number }; fetched_at: string; stale: boolean }>('/flaky') })
      return <QueryState q={q} label="widget">{(d) => <p>got {d.n}</p>}</QueryState>
    }
    renderApp(<Flaky />)
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong (500)')
    fail = false
    await userEvent.click(retry)
    await screen.findByText('got 7')

    function Missing() {
      const q = useQuery({ queryKey: ['missing'], queryFn: () => hubGet<{ data: unknown; fetched_at: string; stale: boolean }>('/nope') })
      return <QueryState q={q} label="player">{() => null}</QueryState>
    }
    renderApp(<Missing />)
    expect(await screen.findByText(/player not found/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Try again' })).toHaveLength(0)
  })

  describe('offline', () => {
    let onLine: PropertyDescriptor | undefined
    beforeEach(() => {
      onLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
      Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
    })
    afterEach(() => {
      if (onLine) Object.defineProperty(Navigator.prototype, 'onLine', onLine)
    })

    it('a query parked by the offline browser says so instead of loading forever', async () => {
      const { onlineManager } = await import('@tanstack/react-query')
      onlineManager.setOnline(false)
      try {
        mockHub({})
        function Parked() {
          const q = useQuery({ queryKey: ['parked'], queryFn: () => hubGet<{ data: unknown; fetched_at: string; stale: boolean }>('/x') })
          return <QueryState q={q} label="live data">{() => null}</QueryState>
        }
        renderApp(<Parked />)
        expect(await screen.findByText(/can't load live data while you're offline/i)).toBeInTheDocument()
      } finally {
        onlineManager.setOnline(true)
      }
    })
  })

  it('a crashing page is contained by the boundary, with a way to retry', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let explode = true
    function Bomb() {
      if (explode) throw new Error('unexpected shape')
      return <p>recovered</p>
    }
    renderApp(
      <>
        <nav>still here</nav>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/hit a snag/i)
    expect(screen.getByText('still here')).toBeInTheDocument()
    explode = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('recovered')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('plural', () => {
    expect(plural(1, 'player')).toBe('1 player')
    expect(plural(0, 'player')).toBe('0 players')
    expect(plural(1200, 'vote')).toBe('1,200 votes')
    expect(plural(2, 'series', 'series')).toBe('2 series')
  })
})
