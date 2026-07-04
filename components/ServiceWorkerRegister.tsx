'use client'

import { useEffect } from 'react'

// Registers the app-shell service worker (public/sw.js) so Tracker is
// installable and opens offline. Production-only: in `next dev` a service worker
// interferes with Turbopack HMR, so we skip it there.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failures are non-fatal — the app works without the SW.
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])
  return null
}
