'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { EMOJIS } from '@/lib/constants'
import { LIST_TEMPLATES, templateColumns, newColumn, type ListTemplate } from '@/lib/lists'
import type { ListColumn } from '@/lib/types'

// Create a new list: pick a template (pre-fills name, emoji, columns) or start
// blank, then tweak the name/emoji. Columns are edited later on the list page.
export default function AddListModal({
  onClose,
  onCreate,
  busy,
}: {
  onClose: () => void
  onCreate: (input: { name: string; emoji: string; columns: ListColumn[] }) => void
  busy: boolean
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📋')
  const [columns, setColumns] = useState<ListColumn[]>([])
  const [picked, setPicked] = useState(false) // a template (or Blank) has been chosen

  function choose(t: ListTemplate) {
    setName(t.name)
    setEmoji(t.emoji)
    setColumns(templateColumns(t))
    setPicked(true)
  }

  function chooseBlank() {
    setName('')
    setEmoji('📋')
    setColumns([newColumn('Name', 'text')])
    setPicked(true)
  }

  const canCreate = picked && name.trim().length > 0 && !busy

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">New list</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100">
            <X size={20} />
          </button>
        </div>

        {!picked ? (
          <>
            <p className="mb-3 text-sm text-zinc-500">Start from a template — you can edit its columns anytime.</p>
            <div className="grid grid-cols-2 gap-2">
              {LIST_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => choose(t)}
                  className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-3 text-left hover:border-indigo-400 hover:bg-indigo-50/50"
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="text-[11px] text-zinc-400">{t.columns.map(([n]) => n).join(' · ')}</span>
                </button>
              ))}
              <button
                onClick={chooseBlank}
                className="flex flex-col gap-1 rounded-xl border border-dashed border-zinc-300 p-3 text-left hover:border-indigo-400 hover:bg-indigo-50/50"
              >
                <span className="text-xl">＋</span>
                <span className="text-sm font-semibold">Blank</span>
                <span className="text-[11px] text-zinc-400">Start from scratch</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="e.g. Movies watched"
              className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />

            <label className="mb-1 block text-xs font-medium text-zinc-500">Icon</label>
            <div className="mb-5 flex flex-wrap gap-1.5">
              {[emoji, ...EMOJIS.filter((e) => e !== emoji)].map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                    e === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-zinc-100 hover:bg-zinc-200'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPicked(false)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Back
              </button>
              <button
                onClick={() => onCreate({ name: name.trim(), emoji, columns })}
                disabled={!canCreate}
                className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Create list
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
