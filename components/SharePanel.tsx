'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react'
import type { Share, Tracker } from '@/lib/types'
import { getMyShare, createShare, updateShare, deleteShare, updateTracker } from '@/lib/db'
import { newShareToken, shareUrl } from '@/lib/share'

// Bottom-sheet settings for the public share page: turn it on/off, name it,
// copy/rotate the link, and pick which to-dos appear. The page is off until a
// share row exists, and nothing is shown until at least one to-do opts in.
export default function SharePanel({
  trackers,
  defaultName,
  onTrackerShared,
  onClose,
}: {
  trackers: Tracker[]
  defaultName: string
  // Parent owns the trackers array; called after a successful opt-in/out write.
  onTrackerShared: (id: string, shared: boolean) => void
  onClose: () => void
}) {
  const [share, setShare] = useState<Share | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(false)
  const [busyTracker, setBusyTracker] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    getMyShare()
      .then((s) => {
        if (!alive) return
        setShare(s)
        setName(s?.display_name ?? '')
      })
      .catch((e) => alive && setError(friendly(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  function friendly(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('shares') || msg.includes('shared'))
      return 'Sharing needs a database update — run supabase/13-sharing.sql first.'
    return msg || 'Something went wrong. Try again.'
  }

  async function turnOn() {
    setBusy(true)
    setError(null)
    try {
      const s = await createShare((name || defaultName).trim().slice(0, 60) || 'My progress', newShareToken())
      setShare(s)
      setName(s.display_name)
    } catch (e) {
      setError(friendly(e))
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    if (!share) return
    setBusy(true)
    setError(null)
    try {
      await deleteShare(share.id)
      setShare(null)
    } catch (e) {
      setError(friendly(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveName() {
    if (!share) return
    const next = name.trim().slice(0, 60)
    if (!next || next === share.display_name) {
      setName(share.display_name)
      return
    }
    try {
      setShare(await updateShare(share.id, { display_name: next }))
    } catch (e) {
      setName(share.display_name)
      setError(friendly(e))
    }
  }

  // Rotate the token: the old link stops working immediately.
  async function newLink() {
    if (!share) return
    setBusy(true)
    setError(null)
    try {
      setShare(await updateShare(share.id, { token: newShareToken() }))
    } catch (e) {
      setError(friendly(e))
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!share) return
    try {
      await navigator.clipboard.writeText(shareUrl(window.location.origin, share.token))
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Could not copy — long-press the link to copy it manually.')
    }
  }

  async function toggleTracker(t: Tracker) {
    const next = !t.shared
    setBusyTracker(t.id)
    setError(null)
    try {
      await updateTracker(t.id, { shared: next })
      onTrackerShared(t.id, next)
    } catch (e) {
      setError(friendly(e))
    } finally {
      setBusyTracker(null)
    }
  }

  const url = share ? shareUrl(typeof window === 'undefined' ? '' : window.location.origin, share.token) : null
  const sharedCount = trackers.filter((t) => t.shared).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-lg font-bold">Public page</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          A read-only dashboard anyone with the link can follow. It shows daily totals, streaks, and
          charts for the to-dos you pick — never your notes or resources.
        </p>

        {loading ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
          </div>
        ) : !share ? (
          <button
            onClick={turnOn}
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Turn on my public page
          </button>
        ) : (
          <div className="space-y-4">
            {/* Display name */}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">Shown as</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>

            {/* Link + actions */}
            <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <div className="break-all font-mono text-xs text-zinc-600">{url}</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  <ExternalLink size={13} /> Open
                </a>
                <button
                  onClick={newLink}
                  disabled={busy}
                  title="Old link stops working"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <RefreshCw size={13} /> New link
                </button>
              </div>
            </div>

            {/* Tracker opt-in */}
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-medium text-zinc-500">On the page</span>
                <span className="text-[11px] text-zinc-400">
                  {sharedCount === 0 ? 'nothing shared yet' : `${sharedCount} shared`}
                </span>
              </div>
              <div className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
                {trackers.length === 0 && (
                  <p className="p-3 text-sm text-zinc-400">No to-dos yet — add one first.</p>
                )}
                {trackers.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <span className="text-lg">{t.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                    <input
                      type="checkbox"
                      checked={!!t.shared}
                      disabled={busyTracker === t.id}
                      onChange={() => toggleTracker(t)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={turnOff}
              disabled={busy}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              Turn off — the link stops working
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
