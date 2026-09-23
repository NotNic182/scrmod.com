import { describe, it, expect, beforeEach } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { IdentityMenu } from '../../src/web/components/IdentityMenu'
import { readPinned, writePinned } from '../../src/web/lib/identity'

const SIGNED_OUT = { data: { discord: null, player: null }, auth_enabled: true }

describe('identity', () => {
  beforeEach(() => localStorage.clear())

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
  })
})
