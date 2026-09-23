import type { ReactNode } from 'react'

/** One stroke set for the whole app: 24px grid, 1.75 stroke, round joins. Decorative by default. */
const PATHS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v11h13V9" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  boards: (
    <>
      <path d="M2.5 20.5h19" />
      <path d="M9.25 20.5V5.5h5.5v15" />
      <path d="M3.75 20.5v-8h5.5" />
      <path d="M14.75 20.5v-5.5h5.5v5.5" />
    </>
  ),
  results: (
    <>
      <path d="M5.5 21V3.5" />
      <path d="M5.5 4h12l-2.25 4.25L17.5 12.5h-12" />
    </>
  ),
  tournaments: (
    <>
      <path d="M3 5h6v14H3" />
      <path d="M9 12h6.5" />
      <circle cx="18.5" cy="12" r="2.75" />
    </>
  ),
  cards: (
    <>
      <rect x="8" y="2.75" width="12" height="16" rx="2" />
      <path d="M4.5 7v11.5a2.5 2.5 0 0 0 2.5 2.5h9" />
    </>
  ),
  moon: <path d="M20 14.25A8.25 8.25 0 0 1 9.75 4 8.25 8.25 0 1 0 20 14.25Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3.5h6l-.9 5.75L17 12.5H7l2.9-3.25Z" />
      <path d="M12 12.5v8" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.1 1.1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.1-1.1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  chevron: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  trophy: (
    <>
      <path d="M8 4h8v5.5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H5.5a3 3 0 0 0 3 4M16 6h2.5a3 3 0 0 1-3 4" />
      <path d="M12 13.5V17M8.5 20.5h7" />
    </>
  ),
  offline: (
    <>
      <path d="M2.5 8.5a14 14 0 0 1 4.5-2.9M10.5 4.6A14 14 0 0 1 21.5 8.5" />
      <path d="M5.5 12a9 9 0 0 1 3.4-2M14.2 9.8a9 9 0 0 1 4.3 2.2" />
      <path d="M9 15.5a4.5 4.5 0 0 1 6 0" />
      <path d="M12 19.5h.01" />
      <path d="m3 3 18 18" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}
