import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'scrhub.theme'

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // storage unavailable
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // Browser chrome (mobile address bar) matches the game-teal top bar, which is teal in both themes.
    document.querySelector<HTMLMetaElement>('meta[name=theme-color]')?.setAttribute('content', '#0c3440')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}

function subscribeTheme(onChange: () => void) {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => mo.disconnect()
}

/** The theme currently applied to the page, for code that reads colors from CSS (charts) and must redraw on a switch. */
export function useAppliedTheme(): string {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.dataset.theme ?? 'dark',
    () => 'dark',
  )
}
