import { BASE } from '../api/client'
import { WORDMARK } from '../../shared/brand'

/** The SCRmod wordmark. Height follows font-size (1em = cap-to-baseline plus the crown); color is --brand. */
export function Wordmark({ className }: { className?: string }) {
  const f = WORDMARK.face
  return (
    <svg className={`wordmark${className ? ` ${className}` : ''}`} viewBox={WORDMARK.viewBox} role="img" aria-label="SCRmod" focusable="false">
      <path d={WORDMARK.left} fill="currentColor" />
      <image href={`${BASE}/logo.webp`} x={f.x} y={f.y} width={f.width} height={f.height} />
      <path d={WORDMARK.right} fill="currentColor" />
    </svg>
  )
}
