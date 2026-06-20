'use client'

import type { Tracker, Entry } from '@/lib/types'
import { summarize, dayTotals } from '@/lib/stats'
import { addDays } from '@/lib/date'

// Stat tiles + a trailing-30-day bar chart for one tracker.
export default function Analytics({
  tracker,
  entries,
  today,
  since,
}: {
  tracker: Tracker
  entries: Entry[]
  today: string
  since: string
}) {
  const s = summarize(entries, tracker.goal_direction, today, since)
  const totals = dayTotals(entries)
  const unit = tracker.unit?.trim()
  const isCount = tracker.type === 'count'

  // Trailing 30 days for the chart.
  const series: { day: string; value: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const day = addDays(today, -i)
    series.push({ day, value: totals[day] ?? 0 })
  }
  const chartMax = Math.max(1, ...series.map((d) => d.value))

  const goodLabel =
    tracker.goal_direction === 'less' ? 'Clean days' : tracker.goal_direction === 'more' ? 'Good days' : 'Active days'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Current streak" value={`${s.currentStreak}`} sub="days" accent={tracker.color} />
        <Stat label="Longest streak" value={`${s.longestStreak}`} sub="days" />
        <Stat
          label={goodLabel}
          value={`${s.goodDays}`}
          sub={`of ${s.rangeDays} day${s.rangeDays === 1 ? '' : 's'}`}
        />
        {isCount ? (
          <Stat label="Total" value={`${s.total}`} sub={unit || 'logged'} />
        ) : (
          <Stat label="Times done" value={`${s.daysLogged}`} sub="all time" />
        )}
      </div>

      {isCount && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Last 7 days" value={`${s.last7}`} sub={unit || ''} />
          <Stat label="Last 30 days" value={`${s.last30}`} sub={unit || ''} />
          <Stat
            label="Avg / logged day"
            value={s.avgPerLoggedDay ? s.avgPerLoggedDay.toFixed(1) : '0'}
            sub={unit || ''}
          />
        </div>
      )}

      {/* 30-day bar chart */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-3 text-sm font-medium text-zinc-600">Last 30 days</div>
        <div className="flex h-28 items-end gap-[3px]">
          {series.map((d) => (
            <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.value}`}>
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${d.value === 0 ? 2 : Math.max(4, (d.value / chartMax) * 100)}%`,
                  background: d.value === 0 ? '#e4e4e7' : tracker.color,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
          <span>30 days ago</span>
          <span>today</span>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-zinc-400">{sub}</div>}
    </div>
  )
}
