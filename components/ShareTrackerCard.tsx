'use client'

import { useState } from 'react'
import type { SharedTrackerData, StreakSide } from '@/lib/types'
import {
  summarize,
  summarizeMeasure,
  buildBuckets,
  defaultStreakSide,
  resolveRange,
  type Bucket,
  type RangeId,
} from '@/lib/stats'
import { shareSince, totalsToEntries } from '@/lib/share'
import { dayLabel, shortDay, shortMonth } from '@/lib/date'
import { fmtNum } from '@/lib/format'

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
]

// One tracker on the public share page: header, stat tiles, and a bar chart.
// A slimmed-down Analytics — same pure stats over the RPC's day totals, but no
// notes/callouts (notes are never shared) and no custom date pickers.
export default function ShareTrackerCard({ tracker, today }: { tracker: SharedTrackerData; today: string }) {
  const isMeasure = tracker.type === 'measure'
  const isCount = tracker.type === 'count' || tracker.type === 'series'
  const since = shareSince(tracker.created_at, tracker.first_day)
  const entries = totalsToEntries(tracker.id, tracker.totals)

  const side: StreakSide = tracker.streak_side ?? defaultStreakSide(tracker.goal_direction)
  const s = summarize(entries, tracker.goal_direction, side, today, since)
  const m = isMeasure ? summarizeMeasure(entries) : null
  const unit = tracker.unit?.trim()

  const [range, setRange] = useState<RangeId>('month')
  const { start, end } = resolveRange(range, today, since, { from: since, to: today })
  const { granularity, buckets } = buildBuckets(tracker.totals, start, end, isMeasure ? 'avg' : 'sum')
  const chartMax = Math.max(1, ...buckets.map((b) => b.value))

  // Same bar scaling as Analytics: counts from zero; measures from a baseline
  // below the lowest reading so small changes stay visible.
  const present = buckets.map((b) => b.value).filter((v) => v > 0)
  const vMax = present.length ? Math.max(...present) : 1
  const vMin = present.length ? Math.min(...present) : 0
  const base = isMeasure ? Math.max(0, vMin - (vMax - vMin) * 0.25) : 0
  const span = vMax - base
  function barPct(v: number): number {
    if (v === 0) return 2
    if (!isMeasure) return Math.max(4, (v / chartMax) * 100)
    if (span <= 0) return 60
    return Math.max(8, ((v - base) / span) * 100)
  }

  function barTooltip(b: Bucket): string {
    const v = fmtNum(b.value)
    if (granularity === 'day') return `${b.start}: ${v}`
    if (granularity === 'week') return `${shortDay(b.start)}–${shortDay(b.end)}: ${v}`
    return `${shortMonth(b.key)}: ${v}`
  }

  const streakSub = side === 'skipped' ? 'clean days' : 'days'
  const goodLabel =
    tracker.goal_direction === 'less' ? 'Clean days' : tracker.goal_direction === 'more' ? 'Good days' : 'Active days'
  const goalChip =
    tracker.goal_target != null && tracker.goal_period != null
      ? `goal ${tracker.goal_direction === 'less' ? '≤' : '≥'} ${fmtNum(tracker.goal_target)}${unit ? ` ${unit}` : ''} / ${tracker.goal_period}`
      : null
  const denseGap = buckets.length > 40

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-xl"
          style={{ background: `${tracker.color}22` }}
        >
          {tracker.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold leading-tight">{tracker.name}</h2>
          {tracker.subtitle && <p className="truncate text-xs text-zinc-500">{tracker.subtitle}</p>}
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {tracker.type === 'series'
              ? `checklist · ${tracker.step_count} steps`
              : tracker.type === 'measure'
                ? `measurement${unit ? ` · ${unit}` : ''}`
                : `since ${shortDay(since)}`}
            {goalChip ? ` · ${goalChip}` : ''}
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      {isMeasure && m ? (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Latest"
            value={m.latest != null ? fmtNum(m.latest) : '—'}
            sub={m.latestDay ? dayLabel(m.latestDay) : unit || ''}
            accent={tracker.color}
          />
          <Stat label="Average" value={m.daysLogged ? fmtNum(m.average) : '—'} sub={unit || ''} />
          <Stat label="Lowest" value={m.daysLogged ? fmtNum(m.min) : '—'} sub={unit || ''} />
          <Stat label="Highest" value={m.daysLogged ? fmtNum(m.max) : '—'} sub={unit || ''} />
        </div>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Current streak" value={`${s.currentStreak}`} sub={streakSub} accent={tracker.color} />
          <Stat label="Longest streak" value={`${s.longestStreak}`} sub={streakSub} />
          <Stat label={goodLabel} value={`${s.goodDays}`} sub={`of ${s.rangeDays} day${s.rangeDays === 1 ? '' : 's'}`} />
          {isCount ? (
            <Stat label="Last 30 days" value={fmtNum(s.last30)} sub={unit || 'logged'} />
          ) : (
            <Stat label="Times done" value={`${s.daysLogged}`} sub="all time" />
          )}
        </div>
      )}

      {/* Chart */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              range === r.id ? 'text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            style={range === r.id ? { background: tracker.color } : undefined}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className={`flex h-24 items-end ${denseGap ? 'gap-[1.5px]' : 'gap-[3px]'}`}>
        {buckets.map((b) => (
          <div key={b.key} className="flex h-full flex-1 items-end" title={barTooltip(b)}>
            <div
              className="w-full rounded-sm"
              style={{ height: `${barPct(b.value)}%`, background: b.value === 0 ? '#e4e4e7' : tracker.color }}
            />
          </div>
        ))}
      </div>
      {buckets.length > 0 && (
        <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
          <span>{shortDay(buckets[0].start)}</span>
          <span>{granularity === 'day' ? 'daily' : granularity === 'week' ? 'weekly' : 'monthly'}</span>
          <span>{end === today ? 'today' : shortDay(end)}</span>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-2.5 ring-1 ring-zinc-100">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
    </div>
  )
}
