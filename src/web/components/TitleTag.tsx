import type { CSSProperties } from 'react'

export function TitleTag({ title, color }: { title?: string | null; color?: string | null }) {
  if (!title) return null
  return (
    <span className="chip api-color" style={{ '--api-c': color || undefined, background: 'color-mix(in srgb, currentColor 14%, transparent)' } as CSSProperties}>
      {title}
    </span>
  )
}
