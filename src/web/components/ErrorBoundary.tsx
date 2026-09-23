import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Changing this clears a caught error (the route key: moving to another page gets a fresh try). */
  resetKey?: unknown
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
    return (
      <div className="card" role="alert">
        <h1>This page hit a snag</h1>
        <p className="muted">Something in the data it received didn't look the way SCRmod expected. Other pages should still work.</p>
        <button className="btn" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    )
  }
}
