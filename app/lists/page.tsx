'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, LogOut } from 'lucide-react'
import { listLists, listItemCounts, createList } from '@/lib/db'
import { useUser, signOut } from '@/lib/useUser'
import type { List, ListColumn } from '@/lib/types'
import TopNav from '@/components/TopNav'
import AddListModal from '@/components/AddListModal'
import SignInScreen from '@/components/SignInScreen'

export default function ListsPage() {
  const { user, loading: authLoading } = useUser()
  const [lists, setLists] = useState<List[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!user) return // wait for auth — RLS scopes the queries to this user
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [ls, cs] = await Promise.all([listLists(), listItemCounts()])
        if (!alive) return
        setLists(ls)
        setCounts(cs)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load your lists.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user])

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      </main>
    )
  }
  if (!user) return <SignInScreen />

  async function create(input: { name: string; emoji: string; columns: ListColumn[] }) {
    setCreating(true)
    try {
      const created = await createList(input, lists.length)
      setLists((l) => [...l, created])
      setShowAdd(false)
    } catch {
      setError('Could not create the list. Try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-28 pt-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lists</h1>
          <p className="text-sm text-zinc-500">Movies, restaurants, favorites — anything you keep a list of.</p>
        </div>
        <button
          onClick={signOut}
          title={`Signed in as ${user.email ?? ''} — sign out`}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <TopNav current="lists" />

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-xl bg-zinc-200/70" />
          ))}
        </div>
      ) : error && lists.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-red-500">If this is a fresh setup, make sure migration 12-lists.sql has been applied.</p>
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center">
          <div className="mb-2 text-4xl">🗂️</div>
          <h2 className="mb-1 font-semibold">No lists yet</h2>
          <p className="mb-4 text-sm text-zinc-500">Add your first list — a movie log, restaurants to try, favorite celebrities…</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={18} /> New list
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((l) => (
            <Link
              key={l.id}
              href={`/lists/${l.id}`}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-zinc-100 text-xl">{l.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{l.name}</span>
                <span className="block text-xs text-zinc-400">
                  {(counts[l.id] ?? 0)} {(counts[l.id] ?? 0) === 1 ? 'entry' : 'entries'} · {l.columns.length}{' '}
                  {l.columns.length === 1 ? 'column' : 'columns'}
                </span>
              </span>
              <ChevronRight size={18} className="flex-none text-zinc-300" />
            </Link>
          ))}
        </div>
      )}

      {error && lists.length > 0 && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={() => setShowAdd(true)}
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        className="fixed left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 font-medium text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700"
      >
        <Plus size={20} /> New list
      </button>

      {showAdd && <AddListModal onClose={() => setShowAdd(false)} onCreate={create} busy={creating} />}
    </main>
  )
}
