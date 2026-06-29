'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import type { Section } from '@/lib/types'

// A minimalist section divider on the dashboard: a title above a light rule,
// with a collapse chevron and quiet rename / delete / reorder controls.
export default function SectionHeader({
  section,
  count,
  canMoveUp,
  canMoveDown,
  onToggleCollapse,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  section: Section
  count: number
  canMoveUp: boolean
  canMoveDown: boolean
  onToggleCollapse: () => void
  onRename: (title: string) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(section.title)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function saveRename() {
    const t = draft.trim()
    if (t && t !== section.title) onRename(t)
    else setDraft(section.title)
    setRenaming(false)
  }

  return (
    <div className="mb-2 mt-5 first:mt-0">
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleCollapse}
          aria-label={section.collapsed ? `Expand ${section.title}` : `Collapse ${section.title}`}
          className="-ml-1 flex h-6 w-6 flex-none items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <ChevronDown size={16} className={`transition-transform ${section.collapsed ? '-rotate-90' : ''}`} />
        </button>

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename()
              if (e.key === 'Escape') {
                setDraft(section.title)
                setRenaming(false)
              }
            }}
            onBlur={saveRename}
            maxLength={80}
            className="min-w-0 flex-1 rounded border border-zinc-300 px-1.5 py-0.5 text-sm font-semibold outline-none focus:border-indigo-500"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(section.title)
              setRenaming(true)
            }}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold tracking-wide text-zinc-600 hover:text-zinc-900"
            title="Rename section"
          >
            {section.title}
            <span className="ml-1.5 font-normal text-zinc-400">{count}</span>
          </button>
        )}

        {/* Quiet controls */}
        {confirmDelete ? (
          <div className="flex flex-none items-center gap-1 text-xs">
            <button
              onClick={onDelete}
              className="rounded-md bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-700"
              title="Delete section (its trackers become ungrouped)"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
              aria-label="Cancel"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex flex-none items-center text-zinc-300">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label={`Move ${section.title} up`}
              className="flex h-6 w-5 items-center justify-center rounded hover:bg-zinc-100 hover:text-zinc-600 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label={`Move ${section.title} down`}
              className="flex h-6 w-5 items-center justify-center rounded hover:bg-zinc-100 hover:text-zinc-600 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${section.title}`}
              className="ml-0.5 flex h-6 w-6 items-center justify-center rounded hover:bg-zinc-100 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      <hr className="mt-1.5 border-zinc-200" />
    </div>
  )
}
