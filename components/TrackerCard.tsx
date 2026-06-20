'use client'

import Link from 'next/link'
import { Minus, Plus, Check, ChevronRight } from 'lucide-react'
import type { Tracker } from '@/lib/types'

// One row on the dashboard. `todayTotal` is the tracker's logged value for
// today; `onLog` applies a delta (+1 / -1) with optimistic UI handled by the
// parent.
export default function TrackerCard({
  tracker,
  todayTotal,
  busy,
  onLog,
}: {
  tracker: Tracker
  todayTotal: number
  busy: boolean
  onLog: (delta: number) => void
}) {
  const done = todayTotal > 0
  const unit = tracker.unit?.trim()

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <Link
        href={`/t/${tracker.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label={`Open ${tracker.name}`}
      >
        <span
          className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-xl"
          style={{ background: tracker.color + '22' }}
        >
          {tracker.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{tracker.name}</span>
          <span className="block text-xs text-zinc-500">
            {tracker.type === 'yesno'
              ? done
                ? 'Done today'
                : 'Not yet today'
              : `${todayTotal}${unit ? ' ' + unit : ''} today`}
          </span>
        </span>
        <ChevronRight size={16} className="flex-none text-zinc-300" />
      </Link>

      {/* Logging controls */}
      {tracker.type === 'yesno' ? (
        <button
          onClick={() => onLog(done ? -1 : 1)}
          disabled={busy}
          aria-pressed={done}
          aria-label={done ? 'Mark not done' : 'Mark done'}
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-full transition disabled:opacity-50 ${
            done ? 'text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
          }`}
          style={done ? { background: tracker.color } : undefined}
        >
          <Check size={22} />
        </button>
      ) : (
        <div className="flex flex-none items-center gap-1">
          <button
            onClick={() => onLog(-1)}
            disabled={busy || todayTotal <= 0}
            aria-label="Subtract one"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30"
          >
            <Minus size={18} />
          </button>
          <span className="w-7 text-center text-lg font-semibold tabular-nums">{todayTotal}</span>
          <button
            onClick={() => onLog(1)}
            disabled={busy}
            aria-label="Add one"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: tracker.color }}
          >
            <Plus size={22} />
          </button>
        </div>
      )}
    </div>
  )
}
