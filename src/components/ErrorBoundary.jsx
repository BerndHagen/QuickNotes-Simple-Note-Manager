import React from 'react'
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
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white dark:bg-gray-900">
          <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            Something went wrong
          </h2>
          <p className="max-w-md mb-6 text-sm text-gray-500 dark:text-gray-400">
            An unexpected error occurred. You can try again or reload the page.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700"
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
