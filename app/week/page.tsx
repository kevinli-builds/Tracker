'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Flame, StickyNote, CalendarCheck } from 'lucide-react'
import { listTrackers, listAllEntries, listNotesInRange, type DayNoteRow } from '@/lib/db'
import { todayKey, toDayKey, addDays, startOfWeek, shortDay, dayLabel } from '@/lib/date'
import { dayTotals, weekReview, defaultStreakSide, type WeekReview } from '@/lib/stats'
import { fmtNum } from '@/lib/format'
import { useUser } from '@/lib/useUser'
import type { Tracker, Entry } from '@/lib/types'
import SignInScreen from '@/components/SignInScreen'

// One tracker's computed weekly summary, plus the type/labels the row needs.
interface Row {
  tracker: Tracker
  review: WeekReview
}

export default function WeekPage() {
  const { user, loading: authLoading } = useUser()
  const [rows, setRows] = useState<Row[]>([])
  const [notes, setNotes] = useState<DayNoteRow[]>([])
  const [names, setNames] = useState<Record<string, Tracker>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = todayKey()
  const thisStart = startOfWeek(today)
  const thisEnd = addDays(thisStart, 6)
  const lastStart = addDays(thisStart, -7)
  const lastEnd = addDays(thisStart, -1)

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [trackers, entries, weekNotes] = await Promise.all([
          listTrackers(),
          listAllEntries(),
          listNotesInRange(thisStart, thisEnd),
        ])
        if (!alive) return
        // Group every entry by tracker so streaks see full history.
        const byTracker: Record<string, Entry[]> = {}
        for (const e of entries) (byTracker[e.tracker_id] ??= []).push(e)

        const built: Row[] = trackers.map((t) => {
          const totals = dayTotals(byTracker[t.id] ?? [])
          const side = t.streak_side ?? defaultStreakSide(t.goal_direction)
          const since = trackerSince(t, totals)
          return {
            tracker: t,
            review: weekReview(totals, side, thisStart, thisEnd, lastStart, lastEnd, today, since),
          }
        })
        const nameMap: Record<string, Tracker> = {}
        for (const t of trackers) nameMap[t.id] = t
        setRows(built)
        setNames(nameMap)
        setNotes(weekNotes)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load your week.')
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

  const anyLogged = rows.some((r) => r.review.thisWeek > 0 || r.review.lastWeek > 0)

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-16 pt-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={16} /> Dashboard
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Your week</h1>
        <p className="text-sm text-zinc-500">
          {shortDay(thisStart)} – {shortDay(thisEnd)}
        </p>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-200/70" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-zinc-500 ring-1 ring-black/5">
          No trackers yet — add some on the dashboard, then check back Sunday.
        </p>
      ) : (
        <>
          {!anyLogged && (
            <p className="mb-4 rounded-xl bg-white p-4 text-center text-sm text-zinc-500 ring-1 ring-black/5">
              Nothing logged yet this week or last. Your summary fills in as you log.
            </p>
          )}
          <div className="space-y-2">
            {rows.map((r) => (
              <WeekRow key={r.tracker.id} row={r} />
            ))}
          </div>

          <Link
            href="/insights"
            className="mt-4 flex items-center justify-between rounded-xl bg-white p-3 text-sm ring-1 ring-black/5 hover:ring-black/10"
          >
            <span className="font-medium text-zinc-700">🔗 What moves together</span>
            <span className="text-xs text-zinc-400">patterns across your trackers →</span>
          </Link>

          {notes.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-600">
                <StickyNote size={15} className="text-zinc-400" /> Notes this week
              </h2>
              <div className="space-y-2">
                {notes.map((n, i) => {
                  const t = names[n.tracker_id]
                  return (
                    <div key={i} className="rounded-xl bg-white p-3 text-sm ring-1 ring-black/5">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
                        {t && <span>{t.emoji}</span>}
                        <span className="font-medium text-zinc-500">{t?.name ?? 'Tracker'}</span>
                        <span>·</span>
                        <span>{dayLabel(n.day)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-zinc-700">{n.note}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

// since = the tracker's created day, or its earliest logged day if that's older
// (so honest backfilling still extends a streak). Mirrors the detail page.
function trackerSince(t: Tracker, totals: Record<string, number>): string {
  const created = toDayKey(new Date(t.created_at))
  const days = Object.keys(totals)
  if (days.length === 0) return created
  const earliest = days.reduce((a, b) => (a < b ? a : b))
  return earliest < created ? earliest : created
}

function WeekRow({ row }: { row: Row }) {
  const { tracker: t, review: r } = row
  const unit = t.unit?.trim()
  const isMeasure = t.type === 'measure'

  // Headline number, phrased per type.
  const headline = isMeasure
    ? `${r.activeDays} ${r.activeDays === 1 ? 'day' : 'days'} logged`
    : t.type === 'yesno'
      ? `${r.thisWeek} / 7 days`
      : t.type === 'series'
        ? `${fmtNum(r.thisWeek)} steps`
        : `${fmtNum(r.thisWeek)}${unit ? ' ' + unit : ''}`

  // Delta vs last week, judged by goal direction (for 'less', down is good).
  const goodDir = t.goal_direction === 'less' ? -1 : 1
  const improved = Math.sign(r.delta) === goodDir
  const deltaTone =
    t.goal_direction === 'neutral' || r.delta === 0
      ? 'text-zinc-400'
      : improved
        ? 'text-emerald-600'
        : 'text-red-500'

  return (
    <Link
      href={`/t/${t.id}`}
      className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5 hover:ring-black/10"
    >
      <span
        className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-xl"
        style={{ background: t.color + '22' }}
      >
        {t.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t.name}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-700">{headline}</span>
          {!isMeasure && (
            <span className={`flex items-center gap-0.5 ${deltaTone}`}>
              {r.delta > 0 ? (
                <TrendingUp size={12} />
              ) : r.delta < 0 ? (
                <TrendingDown size={12} />
              ) : null}
              {r.delta === 0 ? 'same as last week' : `${r.delta > 0 ? '+' : ''}${fmtNum(r.delta)} vs last week`}
            </span>
          )}
          {isMeasure && r.bestDay && (
            <span className="text-zinc-400">high {fmtNum(r.bestDay.value)}{unit ? ' ' + unit : ''}</span>
          )}
        </div>
        {!isMeasure && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-0.5">
              <CalendarCheck size={11} /> {r.activeDays}/7 active
            </span>
            {r.currentStreak > 0 && (
              <span className="flex items-center gap-0.5">
                <Flame size={11} /> {r.currentStreak}-day streak
              </span>
            )}
            {r.bestDay && r.bestDay.value > 0 && t.type !== 'yesno' && (
              <span>best {shortDay(r.bestDay.day)} ({fmtNum(r.bestDay.value)})</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
