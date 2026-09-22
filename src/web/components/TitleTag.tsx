export function TitleTag({ title, color }: { title?: string | null; color?: string | null }) {
  if (!title) return null
  return (
    <span className="chip" style={{ color: color || 'var(--fg-muted)', background: 'color-mix(in srgb, currentColor 14%, transparent)' }}>
      {title}
    </span>
  )
}
