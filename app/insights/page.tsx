'use client'

// Global Insights — "what moves together" (OPUS_BRIEF §9 I1 wiring).
// Pure engine: lib/stats.ts correlationFindings (phi / point-biserial / r with
// minimum-sample guards). House rules: observation phrasing ("tends to go
// with"), never causation; always show n; nothing renders below the guards.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Link2, MoveRight } from 'lucide-react'
import { listTrackers, listAllEntries } from '@/lib/db'
import { todayKey, toDayKey } from '@/lib/date'
import {
  dayTotals,
  correlationFindings,
  MIN_OVERLAP_DAYS,
  type TrackerSeries,
  type CorrelationFinding,
} from '@/lib/stats'
import { useUser } from '@/lib/useUser'
import type { Tracker, Entry } from '@/lib/types'
import SignInScreen from '@/components/SignInScreen'

export default function InsightsPage() {
  const { user, loading: authLoading } = useUser()
  const [findings, setFindings] = useState<CorrelationFinding[]>([])
  const [trackers, setTrackers] = useState<Record<string, Tracker>>({})
  const [trackerCount, setTrackerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = todayKey()

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [ts, entries] = await Promise.all([listTrackers(), listAllEntries()])
        if (!alive) return
        const byTracker: Record<string, Entry[]> = {}
        for (const e of entries) (byTracker[e.tracker_id] ??= []).push(e)

        const series: TrackerSeries[] = ts.map((t) => {
          const totals = dayTotals(byTracker[t.id] ?? [])
          const created = toDayKey(new Date(t.created_at))
          const days = Object.keys(totals)
          const earliest = days.length ? days.reduce((a, b) => (a < b ? a : b)) : created
          return {
            id: t.id,
            name: t.name,
            type: t.type,
            totals,
            since: earliest < created ? earliest : created,
          }
        })

        const map: Record<string, Tracker> = {}
        for (const t of ts) map[t.id] = t
        setTrackers(map)
        setTrackerCount(ts.length)
        setFindings(correlationFindings(series, today))
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load insights.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, today])

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      </main>
    )
  }
  if (!user) return <SignInScreen />

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-16 pt-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={16} /> Dashboard
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">What moves together</h1>
        <p className="text-sm text-zinc-500">
          Patterns across your trackers — observations, not causes.
        </p>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-200/70" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : findings.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-black/5">
          <p className="mb-2 font-medium text-zinc-700">Nothing to report yet — and that&apos;s honest.</p>
          <p>
            A pair only shows up here after {MIN_OVERLAP_DAYS}+ days tracked together with a
            clear signal{trackerCount < 2 ? ' — and it takes at least two trackers to have a pair' : ''}.
            Keep logging; patterns surface on their own.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map((f, i) => (
            <FindingRow key={`${f.aId}-${f.bId}-${f.lag}-${i}`} f={f} trackers={trackers} />
          ))}
        </div>
      )}

      {!loading && !error && findings.length > 0 && (
        <p className="mt-6 text-[11px] leading-relaxed text-zinc-400">
          “Tends to go with” is a correlation in your own history — it doesn&apos;t say one thing
          causes the other. Each line shows how many overlapping days it rests on; stronger
          and better-sampled patterns rank higher.
        </p>
      )}
    </main>
  )
}

function FindingRow({ f, trackers }: { f: CorrelationFinding; trackers: Record<string, Tracker> }) {
  const a = trackers[f.aId]
  const b = trackers[f.bId]
  const positive = f.r > 0
  const strength = Math.abs(f.r) >= 0.6 ? 'strong' : Math.abs(f.r) >= 0.45 ? 'clear' : 'mild'

  const sentence =
    f.lag === 0
      ? positive
        ? 'tend to go together'
        : 'tend to trade off — more of one, less of the other'
      : positive
        ? 'today tends to go with more of'
        : 'today tends to go with less of'

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-base" style={{ background: (a?.color ?? '#888') + '22' }}>
          {a?.emoji ?? '❓'}
        </span>
        <span className="min-w-0 flex-1 leading-snug text-zinc-700">
          {f.lag === 0 ? (
            <>
              <strong>{f.aName}</strong> and <strong>{f.bName}</strong> {sentence}
            </>
          ) : (
            <>
              <strong>{f.aName}</strong> {sentence} <strong>{f.bName}</strong> tomorrow
            </>
          )}
        </span>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-base" style={{ background: (b?.color ?? '#888') + '22' }}>
          {b?.emoji ?? '❓'}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 pl-10 text-[11px] text-zinc-400">
        {f.lag === 1 ? <MoveRight size={11} /> : <Link2 size={11} />}
        <span>
          {strength} pattern · r {f.r > 0 ? '+' : ''}{f.r.toFixed(2)} · {f.n} overlapping days
        </span>
      </div>
    </div>
  )
}
