import { describe, it, expect } from 'vitest'
import type { Entry } from './types'
import {
  dayTotals,
  isGoodDay,
  dayRange,
  currentStreak,
  longestStreak,
  summarize,
} from './stats'

function entry(day: string, value = 1): Entry {
  return { id: day + value + Math.random(), tracker_id: 't', day, value, logged_at: day }
}

describe('dayTotals', () => {
  it('sums multiple taps on the same day', () => {
    const totals = dayTotals([entry('2026-06-01'), entry('2026-06-01'), entry('2026-06-02', 3)])
    expect(totals).toEqual({ '2026-06-01': 2, '2026-06-02': 3 })
  })
})

describe('isGoodDay', () => {
  it('more/neutral: any activity is good', () => {
    expect(isGoodDay(1, 'more')).toBe(true)
    expect(isGoodDay(0, 'more')).toBe(false)
    expect(isGoodDay(2, 'neutral')).toBe(true)
  })
  it('less: only a clean (zero) day is good', () => {
    expect(isGoodDay(0, 'less')).toBe(true)
    expect(isGoodDay(1, 'less')).toBe(false)
  })
})

describe('dayRange', () => {
  it('is inclusive on both ends', () => {
    expect(dayRange('2026-06-01', '2026-06-03')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
  it('returns empty for an inverted range', () => {
    expect(dayRange('2026-06-03', '2026-06-01')).toEqual([])
  })
})

describe('currentStreak (more)', () => {
  const totals = dayTotals([entry('2026-06-17'), entry('2026-06-18'), entry('2026-06-19')])
  it('counts consecutive good days ending today', () => {
    expect(currentStreak(totals, 'more', '2026-06-19', '2026-06-01')).toBe(3)
  })
  it('is zero when today is missing', () => {
    expect(currentStreak(totals, 'more', '2026-06-20', '2026-06-01')).toBe(0)
  })
})

describe('currentStreak (less)', () => {
  it('counts clean days, breaking on a logged day', () => {
    // Logged (bad) on the 17th; clean since.
    const totals = dayTotals([entry('2026-06-17')])
    expect(currentStreak(totals, 'less', '2026-06-19', '2026-06-01')).toBe(2)
    expect(currentStreak(totals, 'less', '2026-06-17', '2026-06-01')).toBe(0)
  })
})

describe('longestStreak', () => {
  it('finds the longest good run in range', () => {
    const totals = dayTotals([
      entry('2026-06-01'), entry('2026-06-02'),
      // gap on the 3rd
      entry('2026-06-04'), entry('2026-06-05'), entry('2026-06-06'),
    ])
    expect(longestStreak(totals, 'more', '2026-06-06', '2026-06-01')).toBe(3)
  })
})

describe('summarize', () => {
  it('aggregates totals, averages, and trailing windows', () => {
    const entries = [entry('2026-06-18', 2), entry('2026-06-19', 1), entry('2026-06-19', 1)]
    const s = summarize(entries, 'more', '2026-06-19', '2026-06-18')
    expect(s.total).toBe(4)
    expect(s.daysLogged).toBe(2)
    expect(s.avgPerLoggedDay).toBe(2)
    expect(s.last7).toBe(4)
    expect(s.currentStreak).toBe(2)
  })
})
