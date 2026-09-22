import { useEffect, useState } from 'react'
import { relTime } from '../lib/format'

export function DataAge({ fetchedAt, stale }: { fetchedAt: string; stale: boolean }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="age">
      as of {relTime(fetchedAt)}
      {stale ? ' · may be out of date' : ''}
    </div>
  )
}
