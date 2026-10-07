import { Component, type ErrorInfo, type ReactNode } from 'react'
import { PageLoadError, reloadPage } from '../lib/pageLoadError'

interface Props {
  children: ReactNode
  /** Changing this clears a caught error (the route key: moving to another page gets a fresh try). */
  resetKey?: unknown
  onRetry?: () => void
}

/** Keeps one broken page (say, an unexpected API shape) from blanking the whole site: nav and footer stay up. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SCRmod page crashed', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    const loadFailed = this.state.error instanceof PageLoadError
    return (
      <div className="card" role="alert">
        <h1>{loadFailed ? "This page couldn't load" : 'This page hit a snag'}</h1>
        <p className="muted">
          {loadFailed
            ? 'Check your connection, then reload the page. Other pages should still work.'
            : "This page couldn't display the information it received. Try fetching it again. Other pages should still work."}
        </p>
        <button className="btn" onClick={() => {
          if (loadFailed) {
            reloadPage()
            return
          }
          this.props.onRetry?.()
          this.setState({ error: null })
        }}>
          {loadFailed ? 'Reload page' : 'Try again'}
        </button>
      </div>
    )
  }
}
