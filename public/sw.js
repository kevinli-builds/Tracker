// Minimal service worker: caches the app shell so Tracker opens offline while
// keeping data network-first. It only ever touches same-origin GETs — Supabase
// (REST/Auth) and Google OAuth are cross-origin and pass straight through, so
// signed-in data is never served stale from cache.

const CACHE = 'tracker-shell-v1'
const SHELL = ['/', '/week', '/manifest.json', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}) // a failed precache shouldn't block install
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // never touch Supabase/Google

  // Immutable hashed build assets → cache-first (fast, safe to keep).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          }),
      ),
    )
    return
  }

  // Page navigations → network-first, falling back to cache (then the shell)
  // when offline so the app still opens.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    )
  }
})
