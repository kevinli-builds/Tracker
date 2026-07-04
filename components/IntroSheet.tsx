'use client'

import { Plus } from 'lucide-react'

// First-visit intro: shown once when a signed-in user lands on an empty
// dashboard (localStorage 'tracker.introSeen'), reopenable via the header ?.
export default function IntroSheet({ onAdd, onClose }: { onAdd: () => void; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Welcome to Tracker"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 pb-8 shadow-xl sm:rounded-2xl sm:pb-6"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-300 sm:hidden" />
        <h2 className="text-lg font-bold tracking-tight">Welcome 👋</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Track anything you do — or don&rsquo;t do — with one tap a day.
        </p>

        <ul className="mt-4 space-y-2.5 text-sm text-zinc-700">
          <li>
            <span className="mr-2">✅</span>
            <span className="font-semibold">Yes/no</span> — did it happen today? <span className="text-zinc-400">(&ldquo;Went outside&rdquo;)</span>
          </li>
          <li>
            <span className="mr-2">🔢</span>
            <span className="font-semibold">Count</span> — how many today? <span className="text-zinc-400">(&ldquo;Standard drinks&rdquo;)</span>
          </li>
          <li>
            <span className="mr-2">⚖️</span>
            <span className="font-semibold">Measure</span> — a reading that changes <span className="text-zinc-400">(&ldquo;Weight&rdquo;)</span>
          </li>
          <li>
            <span className="mr-2">📋</span>
            <span className="font-semibold">Series</span> — a daily checklist <span className="text-zinc-400">(&ldquo;Night routine&rdquo;)</span>
          </li>
        </ul>

        <p className="mt-3 text-xs text-zinc-400">
          Every tracker gets a calendar, streaks and charts — and any past day is editable, so honest
          backfilling counts.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onAdd}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={18} /> Add your first tracker
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            I&rsquo;ll look around first
          </button>
        </div>
      </div>
    </div>
  )
}
