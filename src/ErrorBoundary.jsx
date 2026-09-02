import { Component } from 'react'

/**
 * Top-level safety net. Without this, an uncaught render error anywhere in the tree
 * unmounts the *entire* React app, leaving a blank page — which looks exactly like
 * "the window closed" to a user (e.g. reported: admin email modal appearing to close
 * on Send). This renders a recoverable fallback instead of a silent blank screen.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2rem',
            textAlign: 'center',
            background: '#0c0a09',
            color: '#e7e5e4',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>Something went wrong.</p>
          <p style={{ fontSize: '0.85rem', color: '#a8a29e', maxWidth: '28rem' }}>
            An unexpected error occurred. Your work was not lost — reload the page to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              borderRadius: '0.5rem',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              color: '#e7e5e4',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
