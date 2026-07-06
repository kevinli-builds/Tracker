'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Plus, MoreHorizontal } from 'lucide-react'
import { getList, listItems, updateList, deleteList, addListItem, updateListItem, deleteListItem } from '@/lib/db'
import { newColumn, COLUMN_TYPES, COLUMN_TYPE_LABEL } from '@/lib/lists'
import { useUser } from '@/lib/useUser'
import type { List, ListItem, ListColumn, ListColumnType } from '@/lib/types'
import SignInScreen from '@/components/SignInScreen'

export default function ListDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useUser()

  const [list, setList] = useState<List | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuCol, setMenuCol] = useState<string | null>(null) // open column menu
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Refs mirror state so blur handlers persist the latest values.
  const listRef = useRef<List | null>(null)
  const itemsRef = useRef<ListItem[]>([])
  useEffect(() => {
    listRef.current = list
  }, [list])
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const l = await getList(id)
        if (!alive) return
        if (!l) {
          setNotFound(true)
          return
        }
        const its = await listItems(id)
        if (!alive) return
        setList(l)
        setItems(its)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load this list.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id, user])

  if (authLoading || loading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      </main>
    )
  }
  if (!user) return <SignInScreen />
  if (notFound || !list) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-6">
        <Link href="/lists" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-indigo-600">
          <ArrowLeft size={16} /> Lists
        </Link>
        <p className="mt-8 text-center text-zinc-500">This list doesn’t exist.</p>
      </main>
    )
  }

  const cols = list.columns

  // ── List-level edits ─────────────────────────────────────────
  async function persistList(patch: Partial<Pick<List, 'name' | 'emoji' | 'columns'>>) {
    const before = listRef.current
    setList((l) => (l ? { ...l, ...patch } : l))
    try {
      await updateList(id, patch)
    } catch {
      if (before) setList(before)
      setError('Could not save. Try again.')
    }
  }

  function renameList(name: string) {
    setList((l) => (l ? { ...l, name } : l)) // local only; persisted on blur
  }

  async function removeList() {
    try {
      await deleteList(id)
      router.push('/lists')
    } catch {
      setError('Could not delete the list. Try again.')
    }
  }

  // ── Column edits ─────────────────────────────────────────────
  function renameColumn(colId: string, name: string) {
    setList((l) => (l ? { ...l, columns: l.columns.map((c) => (c.id === colId ? { ...c, name } : c)) } : l))
  }
  function persistColumns() {
    if (listRef.current) persistList({ columns: listRef.current.columns })
  }
  function setColumnType(colId: string, type: ListColumnType) {
    const next = (listRef.current?.columns ?? []).map((c) => (c.id === colId ? { ...c, type } : c))
    persistList({ columns: next })
    setMenuCol(null)
  }
  function addColumn() {
    const next = [...(listRef.current?.columns ?? []), newColumn('New column', 'text')]
    persistList({ columns: next })
  }
  function deleteColumn(colId: string) {
    const next = (listRef.current?.columns ?? []).filter((c) => c.id !== colId)
    persistList({ columns: next })
    setMenuCol(null)
  }

  // ── Row edits ────────────────────────────────────────────────
  function setCell(itemId: string, colId: string, value: string) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, values: { ...it.values, [colId]: value } } : it)))
  }
  async function persistItem(itemId: string) {
    const it = itemsRef.current.find((x) => x.id === itemId)
    if (!it) return
    try {
      await updateListItem(itemId, it.values)
    } catch {
      setError('Could not save that change. Try again.')
    }
  }
  async function addRow() {
    const sort = items.length
    const optimistic: ListItem = { id: `tmp-${Date.now()}`, list_id: id, values: {}, sort_order: sort, created_at: '' }
    setItems((prev) => [...prev, optimistic])
    try {
      const created = await addListItem(id, {}, sort)
      setItems((prev) => prev.map((it) => (it.id === optimistic.id ? created : it)))
    } catch {
      setItems((prev) => prev.filter((it) => it.id !== optimistic.id))
      setError('Could not add a row. Try again.')
    }
  }
  async function removeRow(itemId: string) {
    const before = itemsRef.current
    setItems((prev) => prev.filter((it) => it.id !== itemId))
    try {
      if (!itemId.startsWith('tmp-')) await deleteListItem(itemId)
    } catch {
      setItems(before)
      setError('Could not delete that row. Try again.')
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-28 pt-6">
      <Link href="/lists" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-indigo-600">
        <ArrowLeft size={16} /> Lists
      </Link>

      <header className="mb-5 mt-3 flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-zinc-100 text-2xl">{list.emoji}</span>
        <input
          value={list.name}
          onChange={(e) => renameList(e.target.value)}
          onBlur={() => listRef.current && persistList({ name: listRef.current.name })}
          maxLength={120}
          aria-label="List name"
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-2xl font-bold tracking-tight outline-none hover:border-zinc-200 focus:border-indigo-500"
        />
        {confirmDelete ? (
          <span className="flex flex-none items-center gap-1">
            <button onClick={removeList} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100">
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete list"
            className="flex-none rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={18} />
          </button>
        )}
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50">
              {cols.map((col) => (
                <th key={col.id} className="border-b border-r border-zinc-200 p-0 text-left align-middle last:border-r-0">
                  <div className="relative flex items-center">
                    <input
                      value={col.name}
                      onChange={(e) => renameColumn(col.id, e.target.value)}
                      onBlur={persistColumns}
                      aria-label="Column name"
                      className="min-w-[110px] flex-1 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:bg-indigo-50"
                    />
                    <button
                      onClick={() => setMenuCol((m) => (m === col.id ? null : col.id))}
                      title="Column options"
                      className="flex-none px-2 py-2 text-zinc-400 hover:text-zinc-700"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {menuCol === col.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuCol(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
                          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Type</p>
                          {COLUMN_TYPES.map((ty) => (
                            <button
                              key={ty}
                              onClick={() => setColumnType(col.id, ty)}
                              className={`block w-full rounded px-2 py-1.5 text-left text-xs font-medium hover:bg-zinc-100 ${
                                ty === col.type ? 'text-indigo-600' : 'text-zinc-700'
                              }`}
                            >
                              {COLUMN_TYPE_LABEL[ty]}
                            </button>
                          ))}
                          {cols.length > 1 && (
                            <button
                              onClick={() => deleteColumn(col.id)}
                              className="mt-1 block w-full rounded border-t border-zinc-100 px-2 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete column
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-11 border-b border-zinc-200 p-0 text-center">
                <button onClick={addColumn} title="Add column" className="px-2 py-2 text-zinc-400 hover:text-indigo-600">
                  <Plus size={16} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-zinc-100 last:border-b-0">
                {cols.map((col) => (
                  <td key={col.id} className="border-r border-zinc-100 p-0 last:border-r-0">
                    <input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={it.values[col.id] ?? ''}
                      onChange={(e) => setCell(it.id, col.id, e.target.value)}
                      onBlur={() => persistItem(it.id)}
                      className="w-full min-w-[120px] bg-transparent px-3 py-2 outline-none focus:bg-indigo-50"
                    />
                  </td>
                ))}
                <td className="w-11 text-center">
                  <button onClick={() => removeRow(it.id)} title="Delete row" className="px-2 py-2 text-zinc-300 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={addRow}
          className="flex w-full items-center gap-1.5 border-t border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-indigo-50/50 hover:text-indigo-600"
        >
          <Plus size={16} /> Add entry
        </button>
      </div>

      {items.length === 0 && (
        <p className="mt-3 text-center text-sm text-zinc-400">No entries yet — tap “Add entry” to log your first one.</p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </main>
  )
}
