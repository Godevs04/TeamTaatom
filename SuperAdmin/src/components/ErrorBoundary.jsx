import React from 'react'
import PropTypes from 'prop-types'
import * as Sentry from '@sentry/react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Check if it's a chunk/module loading error
    const isChunkError = 
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk') ||
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.type === 'TypeError' && error?.message?.includes('module')

    // Don't send chunk/module loading errors to Sentry (they're handled by lazyWithRetry)
    // These are expected when modules fail to load (network issues, cache problems, etc.)
    if (import.meta.env.VITE_SENTRY_DSN && !isChunkError) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      })
    }
    
    // Use dynamic import to avoid circular dependencies
    import('../utils/logger').then(({ default: logger }) => {
      if (isChunkError) {
        // Use debug for module errors (they're expected and handled gracefully)
        logger.debug('SuperAdmin Error Boundary caught module loading error (will be retried):', error)
      } else {
        logger.error('SuperAdmin Error Boundary caught an error:', error, errorInfo)
      }
    }).catch(() => {
      // Fallback to console if logger fails
      if (isChunkError) {
        console.debug('SuperAdmin Error Boundary caught module loading error (will be retried):', error)
      } else {
        console.error('SuperAdmin Error Boundary caught an error:', error, errorInfo)
      }
    })
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error
      const isChunkError = 
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Loading CSS chunk') ||
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        (error?.type === 'TypeError' && error?.message?.includes('module'))

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {isChunkError ? 'Failed to Load Page' : 'Something went wrong'}
            </h1>
            <p className="text-gray-600 mb-6">
              {isChunkError 
                ? 'The page failed to load. This may be due to a recent update. Please refresh your browser or clear your cache.'
                : 'The SuperAdmin dashboard encountered an error. Please refresh the page or contact support.'}
            </p>
            <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
              {isChunkError && (
                <button
                  onClick={() => {
                    // Clear cache and reload
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        names.forEach(name => caches.delete(name))
                      })
                    }
                    window.location.reload()
                  }}
                  className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Clear Cache & Reload
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
}

export default ErrorBoundary
