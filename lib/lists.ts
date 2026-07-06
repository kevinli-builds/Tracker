// Pure helpers for the Lists feature: column factories, quick-start templates,
// and jsonb normalizers (the `columns`/`values` jsonb read back from Supabase is
// coerced into valid shapes here so a hand-edited row can't break the UI).

import type { ListColumn, ListColumnType } from './types'

export const COLUMN_TYPES: ListColumnType[] = ['text', 'date', 'number']
export const COLUMN_TYPE_LABEL: Record<ListColumnType, string> = {
  text: 'Text',
  date: 'Date',
  number: 'Number',
}

const MAX = 200 // cap free-text lengths

export function newColumnId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

export function newColumn(name: string, type: ListColumnType = 'text'): ListColumn {
  return { id: newColumnId(), name, type }
}

// ── Quick-start templates ──────────────────────────────────────────────────
type ColSpec = [name: string, type: ListColumnType]
export interface ListTemplate {
  name: string
  emoji: string
  columns: ColSpec[]
}

export const LIST_TEMPLATES: ListTemplate[] = [
  { name: 'Movies watched', emoji: '🎬', columns: [['Title', 'text'], ['Watched on', 'date'], ['With', 'text'], ['Rating', 'number'], ['Notes', 'text']] },
  { name: 'Music', emoji: '🎵', columns: [['Title', 'text'], ['Artist', 'text'], ['Listened on', 'date'], ['Notes', 'text']] },
  { name: 'Restaurants', emoji: '🍽️', columns: [['Name', 'text'], ['Cuisine', 'text'], ['Location', 'text'], ['Rating', 'number'], ['Notes', 'text']] },
  { name: 'Favorite celebrities', emoji: '⭐', columns: [['Name', 'text'], ['Known for', 'text'], ['Notes', 'text']] },
  { name: 'Books', emoji: '📚', columns: [['Title', 'text'], ['Author', 'text'], ['Finished on', 'date'], ['Rating', 'number'], ['Notes', 'text']] },
]

// Fresh columns (with new ids) from a template.
export function templateColumns(t: ListTemplate): ListColumn[] {
  return t.columns.map(([n, ty]) => newColumn(n, ty))
}

// ── jsonb normalizers (trust boundary for DB reads) ─────────────────────────
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v.slice(0, MAX) : fallback
}

export function normalizeColumns(raw: unknown): ListColumn[] {
  if (!Array.isArray(raw)) return []
  const out: ListColumn[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const col = c as Record<string, unknown>
    if (typeof col.id !== 'string') continue
    const type = COLUMN_TYPES.includes(col.type as ListColumnType) ? (col.type as ListColumnType) : 'text'
    out.push({ id: col.id.slice(0, MAX), name: str(col.name), type })
  }
  return out
}

// A row's jsonb value-map → a plain { string: string } map (drops non-strings).
export function normalizeItemValues(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v.slice(0, MAX)
  }
  return out
}
