'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Tracker, DayTotals } from '@/lib/types'
import { daysInMonth, fromDayKey, monthLabel, todayKey } from '@/lib/date'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// A month grid. Days are tinted by the tracker color: for 'less' goals a clean
// (zero) day is the "good" green tint and logged days show the color; for
// 'more'/'neutral' logged days show the color scaled by how much was logged.
export default function CalendarView({
  tracker,
  totals,
}: {
  tracker: Tracker
  totals: DayTotals
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const today = todayKey()

  const keys = daysInMonth(year, month)
  const leading = fromDayKey(keys[0]).getDay() // 0=Sun
  const monthMax = Math.max(1, ...keys.map((k) => totals[k] ?? 0))

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function cellStyle(key: string): React.CSSProperties {
    const total = totals[key] ?? 0
    const future = key > today
    if (future) return {}
    if (tracker.goal_direction === 'less') {
      // clean day = good (green), logged day = the color (the thing happened)
      if (total === 0) return { background: '#22c55e22' }
      return { background: tracker.color, color: '#fff' }
    }
    // more / neutral: tint scales with amount
    if (total === 0) return {}
    const alpha = 0.35 + 0.65 * Math.min(1, total / monthMax)
    return { background: hexA(tracker.color, alpha), color: alpha > 0.6 ? '#fff' : undefined }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="font-semibold">{monthLabel(year, month)}</div>
        <button
          onClick={() => shift(1)}
          disabled={isCurrentMonth}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400">
        {WEEKDAYS.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {keys.map((key) => {
          const dayNum = fromDayKey(key).getDate()
          const total = totals[key] ?? 0
          const isToday = key === today
          const showCount = tracker.type === 'count' && total > 0
          return (
            <div
              key={key}
              title={`${key}: ${total}`}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm ${
                isToday ? 'ring-2 ring-zinc-900 ring-offset-1' : ''
              } ${total === 0 ? 'text-zinc-400' : ''}`}
              style={cellStyle(key)}
            >
              {showCount ? (
                <span className="font-semibold tabular-nums">{total}</span>
              ) : (
                <span>{dayNum}</span>
              )}
            </div>
          )
        })}
      </div>

      <Legend tracker={tracker} />
    </div>
  )
}

function Legend({ tracker }: { tracker: Tracker }) {
  if (tracker.goal_direction === 'less') {
    return (
      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: '#22c55e22' }} /> clean day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: tracker.color }} /> logged
        </span>
      </div>
    )
  }
  return (
    <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
      less
      <span className="h-3 w-3 rounded bg-zinc-100" />
      <span className="h-3 w-3 rounded" style={{ background: hexA(tracker.color, 0.45) }} />
      <span className="h-3 w-3 rounded" style={{ background: tracker.color }} />
      more
    </div>
  )
}

// '#rrggbb' + alpha 0..1 → 8-digit hex.
function hexA(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return hex + a
}
