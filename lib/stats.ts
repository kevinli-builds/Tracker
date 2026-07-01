// Pure analytics over a tracker's entries. No I/O — easy to unit-test.

import type { Entry, DayTotals, GoalDirection, StreakSide, TrackerStep } from './types'
import { addDays } from './date'

// ---- Series (checklist) ---------------------------------------------------

export interface SeriesProgress {
  done: number // steps checked
  total: number // steps defined
  complete: boolean // all steps checked (and at least one exists)
  next: TrackerStep | null // first unchecked step in order (for the advance button)
}

// Progress for a 'series' tracker given its steps and the set of step ids
// checked (for a given day).
export function seriesProgress(steps: TrackerStep[], checked: Set<string>): SeriesProgress {
  const done = steps.reduce((n, s) => n + (checked.has(s.id) ? 1 : 0), 0)
  return {
    done,
    total: steps.length,
    complete: steps.length > 0 && done === steps.length,
    next: steps.find((s) => !checked.has(s.id)) ?? null,
  }
}

// Sum each day's logged value into a { 'YYYY-MM-DD': total } map.
export function dayTotals(entries: Entry[]): DayTotals {
  const totals: DayTotals = {}
  for (const e of entries) {
    totals[e.day] = (totals[e.day] ?? 0) + e.value
  }
  return totals
}

// Is a day "good" given the goal? For 'less' (tracking something you want to
// avoid) a clean day — zero — is good. Otherwise any activity is good.
export function isGoodDay(total: number, goal: GoalDirection): boolean {
  return goal === 'less' ? total === 0 : total > 0
}

// The streak side that matches a goal by default ('less' → clean-day streaks).
export function defaultStreakSide(goal: GoalDirection): StreakSide {
  return goal === 'less' ? 'skipped' : 'did'
}

// Does a day continue the streak? 'skipped' counts clean (zero) days; 'did'
// counts days with any activity.
export function countsForStreak(total: number, side: StreakSide): boolean {
  return side === 'skipped' ? total === 0 : total > 0
}

// Inclusive list of day keys from `start` to `end`.
export function dayRange(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  // Guard against an inverted range.
  if (start > end) return out
  while (cur <= end) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

// Consecutive streak-side days ending today (walking back, no earlier than `since`).
export function currentStreak(
  totals: DayTotals,
  side: StreakSide,
  today: string,
  since: string,
): number {
  let streak = 0
  let cur = today
  while (cur >= since) {
    if (!countsForStreak(totals[cur] ?? 0, side)) break
    streak++
    cur = addDays(cur, -1)
  }
  return streak
}

// Longest run of consecutive streak-side days between `since` and `today`.
export function longestStreak(
  totals: DayTotals,
  side: StreakSide,
  today: string,
  since: string,
): number {
  let best = 0
  let run = 0
  for (const day of dayRange(since, today)) {
    if (countsForStreak(totals[day] ?? 0, side)) {
      run++
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

export interface TrackerStats {
  total: number // sum of all logged values
  daysLogged: number // days with at least one log
  goodDays: number // days that count as "good" for the goal, within range
  rangeDays: number // total days from first tracking day to today
  currentStreak: number
  longestStreak: number
  avgPerLoggedDay: number // total / daysLogged (0 if none)
  last7: number // logged total over the trailing 7 days
  last30: number // logged total over the trailing 30 days
}

export function summarize(
  entries: Entry[],
  goal: GoalDirection,
  side: StreakSide,
  today: string,
  since: string,
): TrackerStats {
  const totals = dayTotals(entries)
  const total = entries.reduce((s, e) => s + e.value, 0)
  const loggedDayKeys = Object.keys(totals).filter((d) => (totals[d] ?? 0) > 0)
  const daysLogged = loggedDayKeys.length

  const range = dayRange(since, today)
  const goodDays = range.filter((d) => isGoodDay(totals[d] ?? 0, goal)).length

  const sumOver = (n: number) =>
    dayRange(addDays(today, -(n - 1)), today).reduce(
      (s, d) => s + (totals[d] ?? 0),
      0,
    )

  return {
    total,
    daysLogged,
    goodDays,
    rangeDays: range.length,
    currentStreak: currentStreak(totals, side, today, since),
    longestStreak: longestStreak(totals, side, today, since),
    avgPerLoggedDay: daysLogged ? total / daysLogged : 0,
    last7: sumOver(7),
    last30: sumOver(30),
  }
}

// ---- Measure stats --------------------------------------------------------

export interface MeasureStats {
  latest: number | null // most recent reading (null if none)
  latestDay: string | null
  average: number // mean of all daily readings
  min: number
  max: number
  daysLogged: number // days with a reading
}

// Stats for a 'measure' tracker (e.g. weight). A measure day holds a single
// value (latest replaces), so dayTotals' per-day sum is just that value.
export function summarizeMeasure(entries: Entry[]): MeasureStats {
  const totals = dayTotals(entries)
  const days = Object.keys(totals).sort()
  if (days.length === 0) {
    return { latest: null, latestDay: null, average: 0, min: 0, max: 0, daysLogged: 0 }
  }
  const values = days.map((d) => totals[d])
  const latestDay = days[days.length - 1]
  return {
    latest: totals[latestDay],
    latestDay,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    daysLogged: days.length,
  }
}

// ---- Chart range bucketing -----------------------------------------------

// A named chart range. 'custom' uses caller-supplied from/to dates.
export type RangeId = 'week' | 'month' | 'year' | 'all' | 'custom'

// Resolve a named range to an inclusive [start, end] day-key window, relative
// to `today`. 'all' starts at `since` (the tracker's first tracked day).
export function resolveRange(
  range: RangeId,
  today: string,
  since: string,
  custom: { from: string; to: string },
): { start: string; end: string } {
  switch (range) {
    case 'week':
      return { start: addDays(today, -6), end: today }
    case 'year':
      return { start: addDays(today, -364), end: today }
    case 'all':
      return { start: since, end: today }
    case 'custom':
      return { start: custom.from, end: custom.to }
    case 'month':
    default:
      return { start: addDays(today, -29), end: today }
  }
}

export type Granularity = 'day' | 'week' | 'month'

// One bar in the chart: a single day, a week, or a calendar month.
export interface Bucket {
  key: string // unique key (the bucket's first day, or 'YYYY-MM' for months)
  start: string // first day in the bucket
  end: string // last day in the bucket
  value: number // summed total over the bucket
}

// Pick a bar granularity that keeps the bar count readable on a phone: daily up
// to ~6 weeks, weekly up to ~a year, monthly beyond that.
export function chooseGranularity(spanDays: number): Granularity {
  if (spanDays <= 45) return 'day'
  if (spanDays <= 366) return 'week'
  return 'month'
}

// How to combine the days in a bucket: 'sum' for count trackers, 'avg' (mean of
// the days that have a reading) for 'measure' trackers so a weight trend reads
// right instead of piling up.
export type BucketAgg = 'sum' | 'avg'

// Bucket a day-total map across [start, end] into bars at an auto-chosen
// granularity. Empty (inverted range) → no buckets.
export function buildBuckets(
  totals: DayTotals,
  start: string,
  end: string,
  agg: BucketAgg = 'sum',
): { granularity: Granularity; buckets: Bucket[] } {
  const days = dayRange(start, end)
  if (days.length === 0) return { granularity: 'day', buckets: [] }
  const granularity = chooseGranularity(days.length)
  // Combine a set of days. 'avg' ignores days without a reading (so a sparse
  // weigh-in week averages the days you actually logged), 0 if none logged.
  const combine = (ds: string[]): number => {
    if (agg === 'sum') return ds.reduce((s, d) => s + (totals[d] ?? 0), 0)
    const present = ds.filter((d) => d in totals)
    if (present.length === 0) return 0
    return present.reduce((s, d) => s + totals[d], 0) / present.length
  }

  if (granularity === 'day') {
    return {
      granularity,
      buckets: days.map((d) => ({ key: d, start: d, end: d, value: totals[d] ?? 0 })),
    }
  }

  if (granularity === 'week') {
    const buckets: Bucket[] = []
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7)
      buckets.push({
        key: chunk[0],
        start: chunk[0],
        end: chunk[chunk.length - 1],
        value: combine(chunk),
      })
    }
    return { granularity, buckets }
  }

  // month: group consecutive days sharing a 'YYYY-MM' prefix.
  const monthGroups: string[][] = []
  for (const d of days) {
    const last = monthGroups[monthGroups.length - 1]
    if (!last || last[0].slice(0, 7) !== d.slice(0, 7)) monthGroups.push([d])
    else last.push(d)
  }
  const buckets: Bucket[] = monthGroups.map((g) => ({
    key: g[0].slice(0, 7),
    start: g[0],
    end: g[g.length - 1],
    value: combine(g),
  }))
  return { granularity, buckets }
}
