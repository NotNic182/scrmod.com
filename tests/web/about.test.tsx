import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, jsonResponse } from './helpers/mockHub'
import userEvent from '@testing-library/user-event'
import { About } from '../../src/web/pages/About'

describe('About', () => {
  it('explains the data source, privacy controls and shows the server status', async () => {
    mockHub({ '/_status': { mode: 'community', app_version: '0.1.0', features: [], auth_enabled: false, upstream: { base: 'https://competitive-rounds.duckdns.org:8444', version: { version: '1.40.3', fetched_at: null, source: 'discovered' } }, cache: { size: 3 } }, '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(<About />)
    expect(screen.getByText(/appear offline/i)).toBeInTheDocument()
    expect(screen.getByText(/hide gold/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /discord/i })).toHaveAttribute('href', 'https://discord.gg/4tsWadH6tc')
    await waitFor(() => expect(screen.getByText(/community mode/i)).toBeInTheDocument())
    expect(screen.getByText(/1\.40\.3/)).toBeInTheDocument()
  })

  it('shows an error instead of loading forever and retries the status request', async () => {
    let failed = true
    const status = { mode: 'community', app_version: '0.1.0', upstream: { base: 'https://example.com', version: { version: '1.40.3', source: 'discovered' } } }
    mockHub({ '/_status': () => failed ? jsonResponse({ error: 'status_unavailable' }, 500) : jsonResponse(status) })
    renderApp(<About />)
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong (500)')
    expect(screen.queryByText(/loading.*status/i)).not.toBeInTheDocument()
    failed = false
    await userEvent.click(retry)
    expect(await screen.findByText(/community mode/i)).toBeInTheDocument()
  })
})
