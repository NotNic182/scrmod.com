import { useEffect } from 'react'

/** Per-route document title: screen readers announce it on navigation, and tabs/history become tellable apart. */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · SCRmod` : 'SCRmod'
  }, [title])
}
