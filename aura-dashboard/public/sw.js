const CACHE_NAME = 'aura-academy-v3'
const OFFLINE_URLS = ['/index.html']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request

  // Only handle normal GET requests. Never intercept API or non-HTTP requests.
  if (
    request.method !== 'GET' ||
    request.url.includes('/api/') ||
    !request.url.startsWith('http')
  ) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Assets use the network when available. Cache only successful responses so
  // a failed/stale JavaScript response can never replace a working asset.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
