import { useTitle } from '../lib/title'
import { Link } from 'react-router'

export function NotFound() {
  useTitle('Not found')
  return (
    <div className="card">
      <h1>Nothing here</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link className="btn" to="/">
        Back home
      </Link>
    </div>
  )
}
