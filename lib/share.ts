// Pure helpers for the public share page. No I/O — the Supabase reads/writes
// live in db.ts like everything else.

import type { DayTotals, Entry } from './types'
import { toDayKey } from './date'

// An unguessable share token: 32 hex chars (128 random bits). The token is the
// whole secret — the URL works for anyone who has it — so it must come from a
// CSPRNG, never Math.random().
export function newShareToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// The public URL for a token, e.g. https://dailytally.vercel.app/s/<token>.
export function shareUrl(origin: string, token: string): string {
  return `${origin}/s/${token}`
}

// A shared tracker's first tracked day: its created day, or its earliest entry
// day if earlier — the same "honest backfilling counts" convention the detail
// page uses for `since`.
export function shareSince(createdAt: string, firstDay: string | null): string {
  const created = toDayKey(new Date(createdAt))
  return firstDay && firstDay < created ? firstDay : created
}

// Synthesize one Entry per logged day from the RPC's day-total map, so the
// share page can feed the existing summarize()/summarizeMeasure() unchanged
// (both only look at day + value; per-day sums are exactly what they compute).
export function totalsToEntries(trackerId: string, totals: DayTotals): Entry[] {
  return Object.keys(totals)
    .sort()
    .map((day) => ({
      id: `${trackerId}:${day}`,
      tracker_id: trackerId,
      step_id: null,
      day,
      value: Number(totals[day]),
      logged_at: '',
    }))
}
