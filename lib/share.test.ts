import { describe, it, expect } from 'vitest'
import { newShareToken, shareUrl, shareSince, totalsToEntries } from './share'
import { summarize, dayTotals } from './stats'
import { toDayKey } from './date'

describe('newShareToken', () => {
  it('is 32 lowercase hex chars', () => {
    const t = newShareToken()
    expect(t).toMatch(/^[0-9a-f]{32}$/)
  })

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 50 }, newShareToken))
    expect(seen.size).toBe(50)
  })
})

describe('shareUrl', () => {
  it('builds the /s/<token> URL', () => {
    expect(shareUrl('https://dailytally.vercel.app', 'abc123')).toBe(
      'https://dailytally.vercel.app/s/abc123',
    )
  })
})

describe('shareSince', () => {
  // created_at is a timestamptz; the local created day is what the app keys by.
  const createdAt = '2026-06-20T15:30:00.000Z'
  const createdDay = toDayKey(new Date(createdAt))

  it('uses the created day when there are no entries', () => {
    expect(shareSince(createdAt, null)).toBe(createdDay)
  })

  it('uses the earlier entry day when backfilled', () => {
    expect(shareSince(createdAt, '2026-06-01')).toBe('2026-06-01')
  })

  it('ignores a first entry after creation', () => {
    expect(shareSince(createdAt, '2026-12-25')).toBe(createdDay)
  })
})

describe('totalsToEntries', () => {
  it('round-trips through dayTotals', () => {
    const totals = { '2026-07-01': 3, '2026-07-03': 1.5 }
    expect(dayTotals(totalsToEntries('t1', totals))).toEqual(totals)
  })

  it('coerces string values (jsonb numerics can arrive stringly)', () => {
    const entries = totalsToEntries('t1', { '2026-07-01': '2' as unknown as number })
    expect(entries[0].value).toBe(2)
  })

  it('feeds summarize with the same numbers as raw entries would', () => {
    const totals = { '2026-07-10': 2, '2026-07-11': 1, '2026-07-12': 4 }
    const s = summarize(totalsToEntries('t1', totals), 'more', 'did', '2026-07-12', '2026-07-08')
    expect(s.total).toBe(7)
    expect(s.daysLogged).toBe(3)
    expect(s.currentStreak).toBe(3)
    expect(s.longestStreak).toBe(3)
  })
})
