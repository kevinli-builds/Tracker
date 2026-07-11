import { describe, it, expect } from 'vitest'
import type { Entry } from './types'
import {
  dayTotals,
  isGoodDay,
  defaultStreakSide,
  countsForStreak,
  dayRange,
  currentStreak,
  longestStreak,
  summarize,
  summarizeMeasure,
  seriesProgress,
  chooseGranularity,
  buildBuckets,
  resolveRange,
  periodProgress,
  weekReview,
} from './stats'
import type { TrackerStep } from './types'

function entry(day: string, value = 1): Entry {
  return { id: day + value + Math.random(), tracker_id: 't', step_id: null, day, value, logged_at: day }
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

describe('defaultStreakSide', () => {
  it('maps less → skipped, everything else → did', () => {
    expect(defaultStreakSide('less')).toBe('skipped')
    expect(defaultStreakSide('more')).toBe('did')
    expect(defaultStreakSide('neutral')).toBe('did')
  })
})

describe('countsForStreak', () => {
  it('did: any activity continues the streak', () => {
    expect(countsForStreak(1, 'did')).toBe(true)
    expect(countsForStreak(0, 'did')).toBe(false)
  })
  it('skipped: only a clean (zero) day continues the streak', () => {
    expect(countsForStreak(0, 'skipped')).toBe(true)
    expect(countsForStreak(2, 'skipped')).toBe(false)
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

describe('currentStreak (did)', () => {
  const totals = dayTotals([entry('2026-06-17'), entry('2026-06-18'), entry('2026-06-19')])
  it('counts consecutive done days ending today', () => {
    expect(currentStreak(totals, 'did', '2026-06-19', '2026-06-01')).toBe(3)
  })
  it('is zero when today is missing', () => {
    expect(currentStreak(totals, 'did', '2026-06-20', '2026-06-01')).toBe(0)
  })
})

describe('currentStreak (skipped)', () => {
  it('counts clean days, breaking on a logged day', () => {
    // Logged on the 17th; clean since.
    const totals = dayTotals([entry('2026-06-17')])
    expect(currentStreak(totals, 'skipped', '2026-06-19', '2026-06-01')).toBe(2)
    expect(currentStreak(totals, 'skipped', '2026-06-17', '2026-06-01')).toBe(0)
  })
})

describe('longestStreak', () => {
  it('finds the longest done run in range', () => {
    const totals = dayTotals([
      entry('2026-06-01'), entry('2026-06-02'),
      // gap on the 3rd
      entry('2026-06-04'), entry('2026-06-05'), entry('2026-06-06'),
    ])
    expect(longestStreak(totals, 'did', '2026-06-06', '2026-06-01')).toBe(3)
  })
  it('skipped: longest clean run is the gap days', () => {
    const totals = dayTotals([entry('2026-06-01'), entry('2026-06-05')])
    // Clean on 2,3,4 → run of 3.
    expect(longestStreak(totals, 'skipped', '2026-06-06', '2026-06-01')).toBe(3)
  })
})

describe('summarize', () => {
  it('aggregates totals, averages, and trailing windows', () => {
    const entries = [entry('2026-06-18', 2), entry('2026-06-19', 1), entry('2026-06-19', 1)]
    const s = summarize(entries, 'more', 'did', '2026-06-19', '2026-06-18')
    expect(s.total).toBe(4)
    expect(s.daysLogged).toBe(2)
    expect(s.avgPerLoggedDay).toBe(2)
    expect(s.last7).toBe(4)
    expect(s.currentStreak).toBe(2)
  })
})

describe('resolveRange', () => {
  const today = '2026-06-22'
  const since = '2026-01-10'
  const custom = { from: '2026-03-01', to: '2026-03-31' }

  it('week/month/year end today and span the right number of days back', () => {
    expect(resolveRange('week', today, since, custom)).toEqual({ start: '2026-06-16', end: today })
    expect(resolveRange('month', today, since, custom)).toEqual({ start: '2026-05-24', end: today })
    expect(resolveRange('year', today, since, custom)).toEqual({ start: '2025-06-23', end: today })
  })
  it('all starts at the tracker since-day', () => {
    expect(resolveRange('all', today, since, custom)).toEqual({ start: since, end: today })
  })
  it('custom uses the supplied from/to', () => {
    expect(resolveRange('custom', today, since, custom)).toEqual({ start: custom.from, end: custom.to })
  })
})

describe('summarizeMeasure', () => {
  it('reports latest / average / min / max over daily readings', () => {
    const entries = [entry('2026-06-18', 176), entry('2026-06-19', 175), entry('2026-06-21', 174)]
    const m = summarizeMeasure(entries)
    expect(m.latest).toBe(174)
    expect(m.latestDay).toBe('2026-06-21')
    expect(m.min).toBe(174)
    expect(m.max).toBe(176)
    expect(m.average).toBe(175)
    expect(m.daysLogged).toBe(3)
  })
  it('is empty-safe', () => {
    expect(summarizeMeasure([])).toMatchObject({ latest: null, latestDay: null, daysLogged: 0 })
  })
})

describe('buildBuckets (avg)', () => {
  const totals = dayTotals([entry('2026-06-01', 100), entry('2026-06-02', 200)])
  it('averages only the days with a reading in a bucket', () => {
    // Jun 1–7 weekly bucket: two readings (100, 200) → mean 150, not sum 300.
    const { buckets } = buildBuckets(totals, '2026-06-01', '2026-07-20', 'avg')
    expect(buckets[0].value).toBe(150)
    expect(buckets[1].value).toBe(0) // no readings that week
  })
})

describe('seriesProgress', () => {
  const step = (id: string, sort_order: number): TrackerStep => ({
    id,
    tracker_id: 't',
    label: id,
    sort_order,
    created_at: '',
  })
  const steps = [step('a', 0), step('b', 1), step('c', 2)]

  it('reports done/total and the next unchecked step in order', () => {
    const p = seriesProgress(steps, new Set(['a']))
    expect(p.done).toBe(1)
    expect(p.total).toBe(3)
    expect(p.complete).toBe(false)
    expect(p.next?.id).toBe('b') // first unchecked, not 'a'
  })
  it('skips already-checked steps when picking next', () => {
    expect(seriesProgress(steps, new Set(['a', 'b'])).next?.id).toBe('c')
  })
  it('is complete with no next when all are checked', () => {
    const p = seriesProgress(steps, new Set(['a', 'b', 'c']))
    expect(p.complete).toBe(true)
    expect(p.next).toBeNull()
  })
  it('an empty checklist is not complete', () => {
    expect(seriesProgress([], new Set()).complete).toBe(false)
  })
})

describe('chooseGranularity', () => {
  it('scales bar size with the span', () => {
    expect(chooseGranularity(7)).toBe('day')
    expect(chooseGranularity(30)).toBe('day')
    expect(chooseGranularity(90)).toBe('week')
    expect(chooseGranularity(365)).toBe('week')
    expect(chooseGranularity(800)).toBe('month')
  })
})

describe('buildBuckets', () => {
  const totals = dayTotals([
    entry('2026-06-01', 2), entry('2026-06-02', 3), entry('2026-06-10', 5),
  ])
  it('daily: one bucket per day with that day total', () => {
    const { granularity, buckets } = buildBuckets(totals, '2026-06-01', '2026-06-03')
    expect(granularity).toBe('day')
    expect(buckets.map((b) => b.value)).toEqual([2, 3, 0])
  })
  it('weekly: sums each 7-day chunk', () => {
    const { granularity, buckets } = buildBuckets(totals, '2026-06-01', '2026-07-20')
    expect(granularity).toBe('week')
    // First week (Jun 1–7) = 2+3, second week (Jun 8–14) includes Jun 10 = 5.
    expect(buckets[0].value).toBe(5)
    expect(buckets[1].value).toBe(5)
  })
  it('monthly: groups by calendar month over a long span', () => {
    const { granularity, buckets } = buildBuckets(totals, '2026-06-01', '2028-01-01')
    expect(granularity).toBe('month')
    const june = buckets.find((b) => b.key === '2026-06')
    expect(june?.value).toBe(10)
  })
  it('returns no buckets for an inverted range', () => {
    expect(buildBuckets(totals, '2026-06-03', '2026-06-01').buckets).toEqual([])
  })
})

describe('periodProgress', () => {
  it('more: fills toward the target, met at/above it', () => {
    expect(periodProgress(3, 3, 'more')).toEqual({ ratio: 1, met: true })
    expect(periodProgress(4, 3, 'more')).toEqual({ ratio: 4 / 3, met: true })
    expect(periodProgress(1, 3, 'more')).toEqual({ ratio: 1 / 3, met: false })
  })
  it('less: target is a cap, met at/under it, over it means exceeded', () => {
    expect(periodProgress(0, 2, 'less')).toEqual({ ratio: 0, met: true })
    expect(periodProgress(2, 2, 'less')).toEqual({ ratio: 1, met: true })
    expect(periodProgress(3, 2, 'less')).toEqual({ ratio: 1.5, met: false })
  })
  it('guards a zero/absent target (no divide-by-zero)', () => {
    expect(periodProgress(5, 0, 'more').ratio).toBe(0)
  })
})

describe('weekReview', () => {
  // Mon 2026-06-29 … Sun 2026-07-05 is "this week"; the prior week is 06-22…06-28.
  const totals = {
    '2026-06-23': 2, // last week
    '2026-06-25': 1, // last week
    '2026-06-29': 3, // this week (best day)
    '2026-07-01': 1, // this week
    '2026-07-02': 2, // this week — today
  }
  const r = weekReview(totals, 'did', '2026-06-29', '2026-07-05', '2026-06-22', '2026-06-28', '2026-07-02', '2026-06-01')

  it('totals this week and last week and their delta', () => {
    expect(r.thisWeek).toBe(6)
    expect(r.lastWeek).toBe(3)
    expect(r.delta).toBe(3)
  })
  it('counts active days and picks the best day this week', () => {
    expect(r.activeDays).toBe(3)
    expect(r.bestDay).toEqual({ day: '2026-06-29', value: 3 })
  })
  it('computes the current streak ending today (07-01 and 07-02 logged)', () => {
    expect(r.currentStreak).toBe(2)
  })
  it('bestDay is null for a silent week', () => {
    expect(weekReview({}, 'did', '2026-06-29', '2026-07-05', '2026-06-22', '2026-06-28', '2026-07-02', '2026-06-01').bestDay).toBeNull()
  })
})
