import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMe } from '../api/hooks'
import { authUrl } from '../api/client'

export interface Pinned {
  steam_id: string
  display_name: string
}

const KEY = 'scrhub.me'
const EVENT = 'scrhub:me'

export function readPinned(): Pinned | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Pinned
    return p && typeof p.steam_id === 'string' && typeof p.display_name === 'string' ? p : null
  } catch {
    return null
  }
}

export function writePinned(p: Pinned | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: the pin lives for this render only
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useIdentity() {
  const me = useMe()
  const qc = useQueryClient()
  const [pinned, setPinned] = useState<Pinned | null>(readPinned)

  useEffect(() => {
    const sync = () => setPinned(readPinned())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const linked = me.data?.data.player
  const discord = me.data?.data.discord ?? null
  const resolved: Pinned | null = linked ? { steam_id: linked.steam_id, display_name: linked.display_name } : pinned

  const pin = useCallback((p: Pinned) => writePinned(p), [])
  const unpin = useCallback(() => writePinned(null), [])
  const signOut = useCallback(async () => {
    await fetch(authUrl('/logout'), { method: 'POST', credentials: 'same-origin' }).catch(() => undefined)
    await qc.invalidateQueries({ queryKey: ['me'] })
  }, [qc])

  return {
    me: resolved,
    source: linked ? ('discord' as const) : pinned ? ('pinned' as const) : null,
    discord,
    authEnabled: me.data?.auth_enabled ?? false,
    loading: me.isPending,
    pin,
    unpin,
    signOut,
  }
}
