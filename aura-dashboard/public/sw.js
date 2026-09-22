const CACHE_NAME = 'aura-academy-v4'
const OFFLINE_URL = '/index.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)

  // Never cache API calls, cross-origin resources, or non-GET requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Always use the current HTML and JavaScript from the network. Serving an
  // old bundle after a deployment is a common cause of a blank white screen.
  if (request.mode === 'navigate' || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(fetch(request).catch(() => request.mode === 'navigate' ? caches.match(OFFLINE_URL) : Response.error()))
    return
  }

  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {})
      }
      return response
    }).catch(() => caches.match(request))
  )
})
