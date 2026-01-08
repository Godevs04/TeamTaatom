import React from 'react'

/**
 * Wraps React.lazy with retry logic for failed dynamic imports
 * This handles cases where chunk files fail to load due to network issues,
 * cache problems, or deployment updates
 * 
 * @param {Function} importFn - The dynamic import function
 * @param {number} retries - Number of retry attempts (default: 3)
 * @param {number} delay - Initial delay in ms (default: 1000)
 * @returns {React.LazyExoticComponent} - Lazy component with retry logic
 */
export function lazyWithRetry(importFn, retries = 3, delay = 1000) {
  return React.lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptImport = (attempt = 1) => {
        importFn()
          .then(resolve)
          .catch((error) => {
            // Check if it's a chunk/module loading error
            const isChunkError = 
              error?.message?.includes('Failed to fetch dynamically imported module') ||
              error?.message?.includes('Loading chunk') ||
              error?.message?.includes('Loading CSS chunk') ||
              error?.name === 'ChunkLoadError' ||
              error?.code === 'ERR_MODULE_NOT_FOUND' ||
              error?.message?.includes('Importing a module script failed') ||
              error?.type === 'TypeError' && error?.message?.includes('module') ||
              (error?.message && typeof error.message === 'string' && 
               error.message.includes('dynamically imported module'))

            if (isChunkError && attempt < retries) {
              // Retry after delay with exponential backoff
              const retryDelay = delay * Math.pow(2, attempt - 1)
              console.warn(
                `[lazyWithRetry] Module load failed (attempt ${attempt}/${retries}), retrying in ${retryDelay}ms...`,
                error
              )
              
              setTimeout(() => {
                attemptImport(attempt + 1)
              }, retryDelay)
            } else if (isChunkError && attempt >= retries) {
              // All retries failed - try to reload the page
              console.error(
                `[lazyWithRetry] All ${retries} attempts failed. Reloading page...`,
                error
              )
              
              // Show user-friendly message before reload
              if (typeof window !== 'undefined') {
                const shouldReload = window.confirm(
                  'Failed to load page. This may be due to a recent update. Would you like to reload the page?'
                )
                if (shouldReload) {
                  window.location.reload()
                }
              }
              
              // Reject with a more user-friendly error
              reject(
                new Error(
                  'Failed to load page. Please refresh your browser or clear your cache.'
                )
              )
            } else {
              // Non-chunk error - reject immediately
              reject(error)
            }
          })
      }
      
      attemptImport()
    })
  })
}

