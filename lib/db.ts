// Supabase data access. Single-user app (no auth yet) — RLS allows the anon
// key full access. Adding per-user auth later means adding a user_id column
// + policies; the call sites here stay the same.

import { supabase } from './supabase'
import type { Tracker, Entry, TrackerType, GoalDirection } from './types'

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
  type: TrackerType
  color: string
  emoji: string
  unit?: string | null
  goal_direction: GoalDirection
}

export async function createTracker(input: NewTracker): Promise<Tracker> {
  const { data, error } = await supabase
    .from('trackers')
    .insert({ ...input, unit: input.unit || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTracker(id: string): Promise<void> {
  const { error } = await supabase.from('trackers').delete().eq('id', id)
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
  return data ?? []
}

// Entries for ALL trackers on a single day — powers the dashboard's "today" totals.
export async function listEntriesForDay(day: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select('*').eq('day', day)
  if (error) throw error
  return data ?? []
}

// Record one tap (+value) on a day.
export async function addEntry(trackerId: string, day: string, value = 1): Promise<Entry> {
  const { data, error } = await supabase
    .from('entries')
    .insert({ tracker_id: trackerId, day, value })
    .select()
    .single()
  if (error) throw error
  return data
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
