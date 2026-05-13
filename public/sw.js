self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (e) => {
  // Let the browser handle standard fetch by default
  // Add caching later for offline if strictly necessary beyond the DOM listener we have
})
