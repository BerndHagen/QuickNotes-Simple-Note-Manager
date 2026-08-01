import React from 'react'
import { buttonClasses } from './ui'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-surface-raised">
          <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
          <h2 className="mb-2 text-lg font-semibold text-content">
            Something went wrong
          </h2>
          <p className="max-w-md mb-6 text-sm text-content-muted">
            An unexpected error occurred. You can try again or reload the page.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-medium text-content bg-surface-sunken rounded-lg hover:bg-surface-sunken dark:bg-surface-raised dark:text-content-subtle dark:hover:bg-surface-sunken"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className={buttonClasses({ variant: 'primary' })}
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
