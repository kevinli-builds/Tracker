'use client'

import { Check } from 'lucide-react'
import type { TrackerStep } from '@/lib/types'

// A list of a series tracker's steps with checkboxes. Tapping a row toggles
// that step for the day (out of order). Used inline on the dashboard card and
// on the detail page's "today" section.
export default function StepChecklist({
  steps,
  checkedIds,
  busy,
  color,
  onToggle,
}: {
  steps: TrackerStep[]
  checkedIds: Set<string>
  busy?: boolean
  color: string
  onToggle: (stepId: string) => void
}) {
  if (steps.length === 0) {
    return <p className="px-2 py-2 text-xs text-zinc-400">No steps yet.</p>
  }
  return (
    <ul className="space-y-0.5">
      {steps.map((s) => {
        const done = checkedIds.has(s.id)
        return (
          <li key={s.id}>
            <button
              onClick={() => onToggle(s.id)}
              disabled={busy}
              aria-pressed={done}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              <span
                className="flex h-5 w-5 flex-none items-center justify-center rounded-md border transition"
                style={done ? { background: color, borderColor: color } : { borderColor: '#d4d4d8' }}
              >
                {done && <Check size={14} className="text-white" />}
              </span>
              <span className={done ? 'text-zinc-400 line-through' : 'text-zinc-700'}>{s.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
