'use client'

import Link from 'next/link'

// Top-level tab switch between the habit dashboard (Trackers) and the free-form
// collections (Lists). Rendered near the top of both pages.
export default function TopNav({ current }: { current: 'trackers' | 'lists' }) {
  const base = 'flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition'
  const on = 'bg-indigo-600 text-white shadow-sm'
  const off = 'text-zinc-500 hover:bg-zinc-200/60'
  return (
    <nav className="mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1">
      <Link href="/" className={`${base} ${current === 'trackers' ? on : off}`}>
        Trackers
      </Link>
      <Link href="/lists" className={`${base} ${current === 'lists' ? on : off}`}>
        Lists
      </Link>
    </nav>
  )
}
