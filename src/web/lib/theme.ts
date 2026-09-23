import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'scrhub.theme'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

/**
 * The site follows the operating system until the visitor picks the other theme. Only that pick is saved: a
 * saved theme equal to the system's is no choice at all, so it is dropped (this also frees visitors whose
 * system theme an older build saved on their first visit). index.html reaches the same theme before first paint.
 */
function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark'
}

function readChoice(): Theme | null {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'dark' || saved === 'light' ? saved : null
  } catch {
    return null // storage unavailable
  }
}

function writeChoice(choice: Theme | null) {
  try {
    if (choice) localStorage.setItem(KEY, choice)
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: the choice lasts for this visit only
  }
}

function initialChoice(system: Theme): Theme | null {
  const saved = readChoice()
  if (saved === system) {
    writeChoice(null)
    return null
  }
  return saved
}

export function useTheme() {
  const [system, setSystem] = useState<Theme>(systemTheme)
  const [choice, setChoice] = useState<Theme | null>(() => initialChoice(system))
  const theme = choice ?? system

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(LIGHT_QUERY)
    const onChange = (e: { matches: boolean }) => setSystem(e.matches ? 'light' : 'dark')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // Browser chrome (mobile address bar) matches the game-teal top bar, which is teal in both themes.
    document.querySelector<HTMLMetaElement>('meta[name=theme-color]')?.setAttribute('content', '#0c3440')
  }, [theme])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const saved = next === system ? null : next
    writeChoice(saved)
    setChoice(saved)
  }, [theme, system])

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
