import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'

// Initialize Sentry as early as possible
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII === 'true' || true,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development',
    // Traces sample rate for performance monitoring
    tracesSampleRate: 1.0,
    // Session replay sample rate
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Before send hook - ensure errors are properly formatted
    beforeSend(event, hint) {
      // Filter out chunk loading errors (they're often transient and not actionable)
      // These occur when the browser can't fetch a dynamically imported module
      // Usually due to network issues, cache problems, or deployment updates
      if (event.exception && event.exception.values) {
        const firstException = event.exception.values[0];
        const errorValue = firstException?.value || '';
        const errorType = firstException?.type || '';
        
        // Check for chunk loading errors with more comprehensive matching
        const isChunkError = 
          errorValue.includes('Failed to fetch dynamically imported module') ||
          errorValue.includes('Loading chunk') ||
          errorValue.includes('Loading CSS chunk') ||
          errorValue.includes('dynamically imported module') ||
          errorType === 'ChunkLoadError' ||
          errorValue.includes('ERR_MODULE_NOT_FOUND') ||
          (event.request?.url && event.request.url.includes('/assets/') && 
           errorValue.includes('Failed to fetch'));
        
        if (isChunkError) {
          // These are usually transient network/cache issues - don't report them
          // The lazyWithRetry utility will handle retries automatically
          console.debug('[Sentry] Filtered chunk loading error:', errorValue);
          return null;
        }
      }
      
      // Ensure error is properly formatted
      if (event.exception && event.exception.values) {
        event.exception.values.forEach(exception => {
          if (!exception.type || (exception.type === 'Error' && !exception.value)) {
            exception.type = exception.type || 'Error';
            exception.value = exception.value || 'Unknown error';
          }
        });
      }
      return event;
    },
  })
  
  // Make Sentry available globally for logger
  if (typeof window !== 'undefined') {
    window.Sentry = Sentry;
  }
  
  console.log('✅ Sentry initialized successfully for SuperAdmin')
} else {
  console.warn('⚠️  Sentry DSN not found. Sentry error tracking is disabled.')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 2, // Retry failed requests twice
      retryDelay: 1000, // Wait 1 second between retries
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
