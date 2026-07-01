// Supabase data access. Every table is owned by a user (`user_id`) and guarded
// by per-user RLS (`auth.uid() = user_id`), so these queries never pass a
// user_id — the signed-in JWT scopes every read and write, and inserts fill
// `user_id` from `auth.uid()` by default. See supabase/schema.sql.

import { supabase } from './supabase'
import type {
  Tracker,
  Entry,
  TrackerType,
  GoalDirection,
  StreakSide,
  TrackerResource,
  ResourceKind,
  Section,
  TrackerStep,
} from './types'

// True when a PostgREST error means "that table doesn't exist yet" — used to
// tolerate a migration that lags a deploy (e.g. day_notes, tracker_resources).
function isMissingTable(error: { code?: string; message?: string }, table: string): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || (error.message ?? '').includes(table)
}

// The `value` column is numeric; PostgREST can serialize numeric as a string,
// so coerce to a JS number for correct arithmetic (dayTotals, analytics).
function toEntry(row: Entry): Entry {
  return { ...row, value: Number(row.value) }
}

export async function listTrackers(): Promise<Tracker[]> {
  const { data, error } = await supabase
    .from('trackers')
    .select('*')
    .eq('archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getTracker(id: string): Promise<Tracker | null> {
  const { data, error } = await supabase.from('trackers').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null // no rows
    throw error
  }
  return data
}

export interface NewTracker {
  name: string
  subtitle?: string | null
  type: TrackerType
  color: string
  emoji: string
  unit?: string | null
  goal_direction: GoalDirection
  streak_side: StreakSide
}

export async function createTracker(input: NewTracker): Promise<Tracker> {
  const { data, error } = await supabase
    .from('trackers')
    .insert({ ...input, unit: input.unit || null, subtitle: input.subtitle || null })
    .select()
    .single()
  if (error) throw error
  return data
}

// Patch editable settings on a tracker (e.g. which side the streak counts, or
// its position in the dashboard list via sort_order).
export async function updateTracker(
  id: string,
  patch: Partial<
    Pick<
      Tracker,
      | 'streak_side'
      | 'goal_direction'
      | 'name'
      | 'subtitle'
      | 'type'
      | 'color'
      | 'emoji'
      | 'unit'
      | 'sort_order'
      | 'section_id'
    >
  >,
): Promise<Tracker> {
  const { data, error } = await supabase
    .from('trackers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTracker(id: string): Promise<void> {
  const { error } = await supabase.from('trackers').delete().eq('id', id)
  if (error) throw error
}

// ---- Sections (dashboard groups) ------------------------------------------

// All sections, in display order. Tolerates a missing table so the dashboard
// still loads if migration 07-sections.sql lags a deploy.
export async function listSections(): Promise<Section[]> {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error, 'sections')) return []
    throw error
  }
  return data ?? []
}

export async function createSection(title: string, sortOrder: number): Promise<Section> {
  const { data, error } = await supabase
    .from('sections')
    .insert({ title, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSection(
  id: string,
  patch: Partial<Pick<Section, 'title' | 'sort_order' | 'collapsed'>>,
): Promise<Section> {
  const { data, error } = await supabase.from('sections').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Delete a section. Its trackers fall back to ungrouped (FK on delete set null).
export async function deleteSection(id: string): Promise<void> {
  const { error } = await supabase.from('sections').delete().eq('id', id)
  if (error) throw error
}

// ---- Tracker steps (for 'series' trackers) --------------------------------

// All steps for one tracker, in order. Tolerates a missing table (migration 08).
export async function listSteps(trackerId: string): Promise<TrackerStep[]> {
  const { data, error } = await supabase
    .from('tracker_steps')
    .select('*')
    .eq('tracker_id', trackerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error, 'tracker_steps')) return []
    throw error
  }
  return data ?? []
}

// Every step the user owns (RLS-scoped), for the dashboard to group by tracker.
export async function listAllSteps(): Promise<TrackerStep[]> {
  const { data, error } = await supabase
    .from('tracker_steps')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error, 'tracker_steps')) return []
    throw error
  }
  return data ?? []
}

export async function createStep(trackerId: string, label: string, sortOrder: number): Promise<TrackerStep> {
  const { data, error } = await supabase
    .from('tracker_steps')
    .insert({ tracker_id: trackerId, label, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStep(
  id: string,
  patch: Partial<Pick<TrackerStep, 'label' | 'sort_order'>>,
): Promise<TrackerStep> {
  const { data, error } = await supabase.from('tracker_steps').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Delete a step. Its day-checks (entries with this step_id) cascade away.
export async function deleteStep(id: string): Promise<void> {
  const { error } = await supabase.from('tracker_steps').delete().eq('id', id)
  if (error) throw error
}

// All entries for one tracker, oldest first.
export async function listEntries(trackerId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('tracker_id', trackerId)
    .order('logged_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toEntry)
}

// Entries for ALL trackers on a single day — powers the dashboard's "today" totals.
export async function listEntriesForDay(day: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select('*').eq('day', day)
  if (error) throw error
  return (data ?? []).map(toEntry)
}

// Most recent entry per tracker → { trackerId: { day, value } }. Powers the
// dashboard's "days since last logged" hint and a measure card's latest reading.
// RLS scopes this to the user; we pull (tracker_id, day, value) ordered newest
// first and keep the first seen per tracker. Note `value` is a count day's last
// tap, not its daily sum — fine for "days since" and for measure (1 row/day).
export interface LatestEntry {
  day: string
  value: number
}
export async function listLatestEntries(): Promise<Record<string, LatestEntry>> {
  const { data, error } = await supabase
    .from('entries')
    .select('tracker_id, day, value')
    .order('day', { ascending: false })
  if (error) throw error
  const map: Record<string, LatestEntry> = {}
  for (const row of data ?? []) {
    if (!(row.tracker_id in map)) map[row.tracker_id] = { day: row.day, value: Number(row.value) }
  }
  return map
}

// Set a 'measure' day to a single value (latest replaces): clear the day's
// entries, then insert one. Not atomic, but a measure day only ever has 1 row.
export async function setDayValue(trackerId: string, day: string, value: number): Promise<Entry> {
  await clearDay(trackerId, day)
  return addEntry(trackerId, day, value)
}

// Record one tap (+value) on a day. `stepId` tags a 'series' step check.
export async function addEntry(
  trackerId: string,
  day: string,
  value = 1,
  stepId: string | null = null,
): Promise<Entry> {
  const { data, error } = await supabase
    .from('entries')
    .insert({ tracker_id: trackerId, day, value, step_id: stepId })
    .select()
    .single()
  if (error) throw error
  return toEntry(data)
}

// Uncheck a 'series' step for a day (remove its entry).
export async function uncheckStep(trackerId: string, day: string, stepId: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('tracker_id', trackerId)
    .eq('day', day)
    .eq('step_id', stepId)
  if (error) throw error
}

// Undo: remove the most recent tap for a tracker on a given day. Returns true
// if a row was deleted.
export async function removeLastEntry(trackerId: string, day: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('entries')
    .select('id')
    .eq('tracker_id', trackerId)
    .eq('day', day)
    .order('logged_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = data?.[0]
  if (!row) return false
  const { error: delError } = await supabase.from('entries').delete().eq('id', row.id)
  if (delError) throw delError
  return true
}

// Remove every entry for a tracker on a day (used to clear a yes/no day).
export async function clearDay(trackerId: string, day: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('tracker_id', trackerId)
    .eq('day', day)
  if (error) throw error
}

// ---- Day notes -----------------------------------------------------------

// All notes for a tracker, as a { 'YYYY-MM-DD': text } map.
export async function listNotes(trackerId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('day_notes')
    .select('day, note')
    .eq('tracker_id', trackerId)
  if (error) {
    // Tolerate the table not existing yet (migration 03-notes.sql not applied)
    // so the rest of the detail page still works without notes.
    if (isMissingTable(error, 'day_notes')) return {}
    throw error
  }
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.day] = row.note
  return map
}

// Notes across ALL trackers on a single day → { trackerId: note }. Powers the
// dashboard's per-card "today's note". Tolerates a missing day_notes table.
export async function listNotesForDay(day: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('day_notes')
    .select('tracker_id, note')
    .eq('day', day)
  if (error) {
    if (isMissingTable(error, 'day_notes')) return {}
    throw error
  }
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.tracker_id] = row.note
  return map
}

// ---- Tracker resources (links + notes attached to the tracker) ------------

// All resources for a tracker, oldest first. Tolerates a missing table so the
// detail page still loads if migration 05-resources.sql lags a deploy.
export async function listResources(trackerId: string): Promise<TrackerResource[]> {
  const { data, error } = await supabase
    .from('tracker_resources')
    .select('*')
    .eq('tracker_id', trackerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error, 'tracker_resources')) return []
    throw error
  }
  return data ?? []
}

export interface NewResource {
  tracker_id: string
  kind: ResourceKind
  title?: string | null
  url?: string | null
  body?: string | null
  file_path?: string | null
  file_name?: string | null
  file_size?: number | null
}

export async function addResource(input: NewResource): Promise<TrackerResource> {
  const { data, error } = await supabase.from('tracker_resources').insert(input).select().single()
  if (error) throw error
  return data
}

// ---- Resource file uploads (private Storage bucket) -----------------------

const FILE_BUCKET = 'resource-files'

// Upload a file to the user's own folder and return its metadata for a 'file'
// resource. Path: <uid>/<tracker_id>/<uuid>-<safe name> (matches storage RLS).
export async function uploadResourceFile(
  trackerId: string,
  file: File,
): Promise<{ file_path: string; file_name: string; file_size: number }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('Not signed in')
  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 100) || 'file'
  const path = `${uid}/${trackerId}/${crypto.randomUUID()}-${safe}`
  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw error
  return { file_path: path, file_name: file.name, file_size: file.size }
}

// Short-lived signed URL to open/download a private resource file.
export async function signedUrlForFile(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

// Remove a resource file's Storage object (call before deleting its row).
export async function removeResourceFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(FILE_BUCKET).remove([path])
  if (error) throw error
}

export async function updateResource(
  id: string,
  patch: Partial<Pick<TrackerResource, 'title' | 'url' | 'body'>>,
): Promise<TrackerResource> {
  const { data, error } = await supabase
    .from('tracker_resources')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from('tracker_resources').delete().eq('id', id)
  if (error) throw error
}

// Save (upsert) or, when the text is empty, delete the note for a day.
export async function saveNote(trackerId: string, day: string, note: string): Promise<void> {
  const text = note.trim()
  if (!text) {
    const { error } = await supabase
      .from('day_notes')
      .delete()
      .eq('tracker_id', trackerId)
      .eq('day', day)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('day_notes')
    .upsert(
      { tracker_id: trackerId, day, note: text, updated_at: new Date().toISOString() },
      { onConflict: 'tracker_id,day' },
    )
  if (error) throw error
}
