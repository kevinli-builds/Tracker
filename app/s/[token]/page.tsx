'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import type { PublicShare } from '@/lib/types'
import { fetchPublicShare } from '@/lib/db'
import { todayKey, dayLabel } from '@/lib/date'
import ShareTrackerCard from '@/components/ShareTrackerCard'

// The public "frontpage": a read-only dashboard for one user's shared to-dos,
// reachable by unguessable token — NO auth gate (the RPC is the anon-safe read
// path). Refetches on tab focus so an open tab keeps up with the day.
export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [share, setShare] = useState<PublicShare | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const today = todayKey()

  // Re-fetch without blanking the page — the refresh button and tab focus.
  // A hiccup here keeps whatever was already shown.
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await fetchPublicShare(token)
      setShare(data)
      setNotFound(data === null)
    } catch {
      // keep the current view
    } finally {
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await fetchPublicShare(token)
        if (!alive) return
        setShare(data)
        setNotFound(data === null)
      } catch {
        if (alive) setNotFound(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.removeEventListener('focus', onFocus)
    }
  }, [token, refresh])

  if (loading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      </main>
    )
  }

  if (notFound || !share) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 text-4xl">🔍</div>
        <h1 className="mb-1 text-lg font-bold">This page isn’t available</h1>
        <p className="mb-6 text-sm text-zinc-500">
          The link may have been turned off or replaced by its owner.
        </p>
        <Footer />
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-16 pt-8">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{share.display_name}</h1>
            <p className="text-sm text-zinc-500">{dayLabel(today)} · following along on DailyTally</p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 hover:text-indigo-600 disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} />
          </button>
        </div>
      </header>

      {share.trackers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center">
          <div className="mb-2 text-4xl">🌱</div>
          <p className="text-sm text-zinc-500">Nothing shared here yet — check back soon.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {share.trackers.map((t) => (
            <ShareTrackerCard key={t.id} tracker={t} today={today} />
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <Footer />
      </div>
    </main>
  )
}

function Footer() {
  return (
    <Link
      href="/"
      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-indigo-600"
    >
      Track your own habits with DailyTally →
    </Link>
  )
}
