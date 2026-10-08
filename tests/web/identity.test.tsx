import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { IdentityMenu } from '../../src/web/components/IdentityMenu'
import { readPinned, writePinned, useIdentity } from '../../src/web/lib/identity'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: true }

describe('identity', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    writePinned(null)
  })

  it('offers search and pins a player from the results', async () => {
    mockHub({ '/me': SIGNED_OUT, '/players/search?q=nic': env({ results: [{ steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101 }] }) })
    renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    await userEvent.type(screen.getByRole('combobox'), 'nic')
    await userEvent.click(await screen.findByRole('option', { name: /NotNic/ }))
    await waitFor(() => expect(screen.getByRole('link', { name: /NotNic/ })).toHaveAttribute('href', '/players/76561199311926326'))
    expect(readPinned()).toEqual({ steam_id: '76561199311926326', display_name: 'NotNic' })
  })

  it('prefers the Discord-linked player over the pin and shows the sign-out control', async () => {
    writePinned({ steam_id: '1', display_name: 'Pinned' })
    mockHub({ '/me': { data: { discord: { id: '1299', username: 'ntnic', avatar: null, global_name: 'Nic' }, player: { steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101, peak_rating: 1337, level: 40 } }, auth_enabled: true } })
    renderApp(<IdentityMenu />)
    await waitFor(() => expect(screen.getByRole('link', { name: /NotNic/ })).toBeInTheDocument())
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /identity options/i }))
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('hides the Discord button when auth is disabled and shows the link hint when unlinked', async () => {
    mockHub({ '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    expect(screen.queryByRole('link', { name: /sign in with discord/i })).not.toBeInTheDocument()

    cleanup()
    mockHub({ '/me': { data: { discord: { id: '1', username: 'x', avatar: null, global_name: null }, player: null }, auth_enabled: true } })
    renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    await waitFor(() => expect(screen.getByText(/link your discord in-game/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('allows an authenticated account without a linked player to sign out', async () => {
    let signedIn = true
    const { calls } = mockHub({
      '/me': () => new Response(JSON.stringify(signedIn ? { data: { discord: { id: '1', username: 'x', avatar: null, global_name: null }, player: null }, auth_enabled: true } : SIGNED_OUT)),
      '/auth/logout': () => { signedIn = false; return new Response(null, { status: 204 }) },
    })
    renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(calls).toContain('/auth/logout')
    expect(await screen.findByRole('link', { name: 'Sign in with Discord' })).toBeInTheDocument()
  })

  it('shares a visit-only pin when readable storage rejects writes and can still unpin', async () => {
    localStorage.setItem('scrhub.me', JSON.stringify({ steam_id: 'old', display_name: 'Old pin' }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    mockHub({ '/me': SIGNED_OUT })
    function Observer() {
      const id = useIdentity()
      return <output>{id.me?.display_name ?? 'No pin'}</output>
    }
    renderApp(<><IdentityMenu /><Observer /></>)
    const next = { steam_id: 'new', display_name: 'שלום 🐈' }
    // A storage-denied write must update all existing observers, overriding the readable old pin.
    const { act } = await import('@testing-library/react')
    act(() => writePinned(next))
    await waitFor(() => expect(screen.getByRole('link', { name: next.display_name })).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(next.display_name)
    expect(readPinned()).toEqual(next)
    await userEvent.click(screen.getByRole('button', { name: 'Identity options' }))
    await userEvent.click(screen.getByRole('button', { name: /unpin/i }))
    expect(await screen.findByRole('button', { name: /find me/i })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No pin')
    expect(readPinned()).toBeNull()
  })

  it('closes the nonmodal profile sheet when keyboard focus leaves it', async () => {
    mockHub({ '/me': SIGNED_OUT })
    renderApp(<><IdentityMenu /><button>Next control</button></>)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    expect(screen.getByRole('combobox')).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Sign in with Discord' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus()
    expect(screen.queryByRole('region', { name: 'Profile options' })).not.toBeInTheDocument()
  })
})
