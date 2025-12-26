/**
 * Service Worker for Offline Support
 * Caches static assets and API responses for offline access
 */

const CACHE_NAME = 'taatom-v1';
const STATIC_CACHE_NAME = 'taatom-static-v1';
const API_CACHE_NAME = 'taatom-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other static assets as needed
];

// API endpoints to cache (read-only endpoints)
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/posts(\?.*)?$/,
  /\/api\/v1\/profile\/[^/]+$/,
  /\/api\/v1\/hashtag\/[^/]+$/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('Failed to cache some static assets:', error);
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name !== CACHE_NAME &&
              name !== STATIC_CACHE_NAME &&
              name !== API_CACHE_NAME
            );
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim(); // Take control of all pages
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with cache-first strategy for GET requests
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);

  // Check if this API endpoint should be cached
  const shouldCache = CACHEABLE_API_PATTERNS.some((pattern) =>
    pattern.test(url.pathname + url.search)
  );

  if (!shouldCache) {
    // For non-cacheable API requests, use network-only
    return fetch(request).catch(() => {
      // Return offline response if network fails
      return new Response(
        JSON.stringify({ error: 'Offline', message: 'No internet connection' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
  }

  // Try cache first, then network
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached response, but also fetch fresh data in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {
        // Ignore background fetch errors
      });
    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache successful responses
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed, return offline response
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No internet connection' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed, return offline page or error
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(API_CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

