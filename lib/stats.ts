// Pure analytics over a tracker's entries. No I/O — easy to unit-test.

import type { Entry, DayTotals, GoalDirection, StreakSide, TrackerStep, TrackerType } from './types'
import { addDays, fromDayKey, startOfWeek } from './date'

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

// ---- Numeric goals --------------------------------------------------------

export interface Progress {
  ratio: number // actual / target, unclamped (>1 means past the target)
  met: boolean // goal satisfied so far this period
}

// Progress toward a numeric goal target given the period's actual total. For a
// 'more' goal (e.g. "≥ 3 runs/week") the bar fills toward the target and is met
// at/above it; for 'less' (e.g. "≤ 2 drinks/week") the target is a cap — the bar
// fills toward it and is met while at/under it. 'neutral' has no target, so
// callers only invoke this for 'more'/'less' trackers.
export function periodProgress(actual: number, target: number, direction: GoalDirection): Progress {
  return {
    ratio: target > 0 ? actual / target : 0,
    met: direction === 'less' ? actual <= target : actual >= target,
  }
}

// ---- Weekly review --------------------------------------------------------

export interface WeekReview {
  thisWeek: number // total logged this week
  lastWeek: number // total logged the prior week (for comparison)
  delta: number // thisWeek − lastWeek
  activeDays: number // days this week with any log
  bestDay: { day: string; value: number } | null // highest-total day this week
  currentStreak: number // streak-side streak ending today
}

// Per-tracker weekly summary: this week vs last, active days, the best day, and
// the current streak. Pure over a day-total map (streaks need full history, so
// pass totals built from all entries, not just the two weeks). `thisEnd` is
// normally today; days beyond it are just absent (zero) and don't skew anything.
export function weekReview(
  totals: DayTotals,
  side: StreakSide,
  thisStart: string,
  thisEnd: string,
  lastStart: string,
  lastEnd: string,
  today: string,
  since: string,
): WeekReview {
  const sum = (start: string, end: string) =>
    dayRange(start, end).reduce((acc, d) => acc + (totals[d] ?? 0), 0)

  let bestDay: { day: string; value: number } | null = null
  let activeDays = 0
  for (const d of dayRange(thisStart, thisEnd)) {
    const v = totals[d] ?? 0
    if (v > 0) {
      activeDays++
      if (!bestDay || v > bestDay.value) bestDay = { day: d, value: v }
    }
  }

  const thisWeek = sum(thisStart, thisEnd)
  const lastWeek = sum(lastStart, lastEnd)
  return {
    thisWeek,
    lastWeek,
    delta: thisWeek - lastWeek,
    activeDays,
    bestDay,
    currentStreak: currentStreak(totals, side, today, since),
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

// ---- Insights: correlations (I1) -------------------------------------------
// House rules: honest statistics — minimum-sample guards, observation-not-
// causation phrasing (the UI says "moves together", never "causes"), and
// nothing renders below the guards. Pearson on the right encodings covers
// every tracker-type pair: binary×binary is the phi coefficient,
// binary×continuous is point-biserial, continuous×continuous is plain r —
// so one correlation core serves yesno, count, measure, and series alike.

// Only pairs observed together on at least this many days are considered.
export const MIN_OVERLAP_DAYS = 20
// Only correlations at least this strong are reported.
export const R_THRESHOLD = 0.3
// A binary (yesno) series needs at least this many days in EACH state —
// a habit done (or skipped) nearly every day correlates with nothing
// meaningfully, and phi degenerates.
export const MIN_STATE_DAYS = 3

export interface TrackerSeries {
  id: string
  name: string
  type: TrackerType
  totals: DayTotals
  since: string // first tracked day (created day or earliest entry)
}

export interface CorrelationFinding {
  aId: string
  aName: string
  bId: string
  bName: string
  r: number // Pearson r on the encoded series, 2dp
  n: number // overlapping days the estimate is based on
  lag: 0 | 1 // 0 = same day; 1 = "a today → b tomorrow"
}

// A tracker's value on a day, or undefined when the day isn't observed:
// before the tracker existed, or (for measures) a day with no reading.
// For the other types an absent day inside the range is a real zero.
function seriesValue(s: TrackerSeries, day: string, today: string): number | undefined {
  if (day < s.since || day > today) return undefined
  const v = s.totals[day]
  if (s.type === 'measure') return v // undefined when no reading — excluded
  if (s.type === 'yesno') return (v ?? 0) > 0 ? 1 : 0
  return v ?? 0
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null // a constant series correlates with nothing
  return sxy / Math.sqrt(sxx * syy)
}

// Guard against degenerate binary series (see MIN_STATE_DAYS).
function binaryStatesOk(s: TrackerSeries, values: number[]): boolean {
  if (s.type !== 'yesno') return true
  const ones = values.filter((v) => v > 0).length
  return ones >= MIN_STATE_DAYS && values.length - ones >= MIN_STATE_DAYS
}

// All pairwise findings that survive the guards, strongest first. Same-day
// pairs are reported once (a↔b); lag-1 pairs are directional ("a today →
// b tomorrow"), so both directions are tested.
export function correlationFindings(series: TrackerSeries[], today: string): CorrelationFinding[] {
  const findings: CorrelationFinding[] = []

  const tryPair = (a: TrackerSeries, b: TrackerSeries, lag: 0 | 1) => {
    const xs: number[] = []
    const ys: number[] = []
    // Walk a's observable range; pair a's day with b's day + lag.
    const start = a.since > b.since ? a.since : b.since
    for (const day of dayRange(start, today)) {
      const va = seriesValue(a, day, today)
      const vb = seriesValue(b, lag === 0 ? day : addDays(day, 1), today)
      if (va === undefined || vb === undefined) continue
      xs.push(va)
      ys.push(vb)
    }
    if (xs.length < MIN_OVERLAP_DAYS) return
    if (!binaryStatesOk(a, xs) || !binaryStatesOk(b, ys)) return
    const r = pearson(xs, ys)
    if (r === null || Math.abs(r) < R_THRESHOLD) return
    findings.push({
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      r: Math.round(r * 100) / 100,
      n: xs.length,
      lag,
    })
  }

  for (let i = 0; i < series.length; i++) {
    for (let j = 0; j < series.length; j++) {
      if (i === j) continue
      if (i < j) tryPair(series[i], series[j], 0) // same-day: symmetric, once
      tryPair(series[i], series[j], 1) // lag: directional, both ways
    }
  }
  findings.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
  return findings
}

// ---- Insights: weekday fingerprint + seasonality (I2) ----------------------

export interface FingerprintCell {
  count: number // days the mean is based on
  mean: number
}

export interface Fingerprint {
  byWeekday: FingerprintCell[] // 7 cells, Monday first (house weeks are Mon→Sun)
  byMonth: FingerprintCell[] // 12 cells, January first
}

// Average value by day-of-week and by calendar month. mode 'allDays' treats
// unlogged in-range days as real zeros (count/yesno habits); 'loggedDays'
// averages only days with a reading (measures — a missing weigh-in is not a
// zero-kg day). The UI should grey out cells with a small `count`.
export function fingerprint(
  totals: DayTotals,
  since: string,
  today: string,
  mode: 'allDays' | 'loggedDays',
): Fingerprint {
  const byWeekday: FingerprintCell[] = Array.from({ length: 7 }, () => ({ count: 0, mean: 0 }))
  const byMonth: FingerprintCell[] = Array.from({ length: 12 }, () => ({ count: 0, mean: 0 }))
  const wkSum = Array(7).fill(0)
  const moSum = Array(12).fill(0)
  for (const day of dayRange(since, today)) {
    const has = day in totals
    if (mode === 'loggedDays' && !has) continue
    const v = totals[day] ?? 0
    const wd = (fromDayKey(day).getDay() + 6) % 7 // JS Sun=0 → Monday-first index
    const mo = Number(day.slice(5, 7)) - 1
    byWeekday[wd].count++
    wkSum[wd] += v
    byMonth[mo].count++
    moSum[mo] += v
  }
  for (let i = 0; i < 7; i++) byWeekday[i].mean = byWeekday[i].count ? wkSum[i] / byWeekday[i].count : 0
  for (let i = 0; i < 12; i++) byMonth[i].mean = byMonth[i].count ? moSum[i] / byMonth[i].count : 0
  return { byWeekday, byMonth }
}

// ---- Insights: streak survival (I3) ----------------------------------------

// Enough ended streaks to say anything about where they tend to end.
export const MIN_COMPLETED_STREAKS = 5

export interface StreakSurvival {
  lengths: number[] // every COMPLETED streak length, in order of occurrence
  ongoing: number // the current (censored) streak, 0 if none — never mixed in
  median: number | null // null below MIN_COMPLETED_STREAKS
  max: number
  // The most common completed length — "most of your streaks end on day N".
  typicalEnd: number | null // null below MIN_COMPLETED_STREAKS
  // % of completed streaks that reached at least `day`, for day 1..max (≤30).
  survival: { day: number; pct: number }[]
}

// Survival analysis over the user's own historical streaks. The streak still
// running today is censored (we don't know how long it will get), so it is
// reported separately and never counted as "ended" — the honest reading, and
// the anti-guilt one: the curve describes the past, it doesn't predict failure.
export function streakSurvival(
  totals: DayTotals,
  side: StreakSide,
  today: string,
  since: string,
): StreakSurvival {
  const lengths: number[] = []
  let run = 0
  for (const day of dayRange(since, today)) {
    if (countsForStreak(totals[day] ?? 0, side)) {
      run++
    } else {
      if (run > 0) lengths.push(run)
      run = 0
    }
  }
  const ongoing = run // reached today without breaking — censored

  const enough = lengths.length >= MIN_COMPLETED_STREAKS
  const sorted = [...lengths].sort((a, b) => a - b)
  const median = enough ? sorted[Math.floor(sorted.length / 2)] : null

  let typicalEnd: number | null = null
  if (enough) {
    const freq = new Map<number, number>()
    for (const l of lengths) freq.set(l, (freq.get(l) ?? 0) + 1)
    let bestCount = 0
    for (const [len, count] of [...freq.entries()].sort((a, b) => a[0] - b[0])) {
      if (count > bestCount) {
        bestCount = count
        typicalEnd = len
      }
    }
  }

  const max = lengths.length ? Math.max(...lengths) : 0
  const survival: { day: number; pct: number }[] = []
  for (let day = 1; day <= Math.min(max, 30); day++) {
    const reached = lengths.filter((l) => l >= day).length
    survival.push({ day, pct: Math.round((reached / lengths.length) * 100) })
  }

  return { lengths, ongoing, median, max, typicalEnd, survival }
}

// ---- Year in Pixels (D1) ---------------------------------------------------

// 0 = nothing logged; 1..4 = increasing amount. The ramp is relative to *this
// tracker's own* year, never a global scale — the poster is self-knowledge, not
// a comparison against anyone else.
export type YearLevel = 0 | 1 | 2 | 3 | 4

export interface YearCell {
  day: string // 'YYYY-MM-DD'
  total: number // 0 when unlogged
  logged: boolean // had at least one entry
  inRange: boolean // between `since` and `today` — outside is untracked, not "a zero"
  level: YearLevel
  col: number // week column, 0-based (weeks run Monday→Sunday, house convention)
  row: number // 0 = Monday .. 6 = Sunday
}

export interface YearGrid {
  year: number
  cells: YearCell[] // every day of the calendar year, in date order
  weeks: number // number of week columns the year spans (52 or 53)
  monthCols: { month0: number; col: number }[] // where each month starts, for labels
  // Upper bound of levels 1..3 when the ramp is quantile-based; empty when the
  // tracker has ≤4 distinct values (then each value maps straight to a level).
  thresholds: number[]
  loggedDays: number
  total: number
  best: { day: string; total: number } | null
}

// Pick the value→level ramp for one year of readings. Two regimes, because a
// quantile split looks broken on habits that only ever log "1":
//   ≤4 distinct values → map them onto the top levels (a single value = full
//   intensity, which is what a yes/no-ish habit should look like);
//   otherwise → quartiles of the logged values.
function levelRamp(values: number[]): { thresholds: number[]; levelOf: (v: number) => YearLevel } {
  const sorted = [...values].sort((a, b) => a - b)
  const uniq = [...new Set(sorted)]
  if (uniq.length === 0) return { thresholds: [], levelOf: () => 0 }
  if (uniq.length <= 4) {
    // 1 value → [4]; 2 → [2,4]; 3 → [2,3,4]; 4 → [1,2,3,4].
    const levels: YearLevel[][] = [[4], [2, 4], [2, 3, 4], [1, 2, 3, 4]]
    const map = levels[uniq.length - 1]
    return {
      thresholds: [],
      levelOf: (v) => (v > 0 ? map[uniq.indexOf(v)] ?? 4 : 0),
    }
  }
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]
  const thresholds = [q(0.25), q(0.5), q(0.75)]
  return {
    thresholds,
    levelOf: (v) => {
      if (v <= 0) return 0
      if (v <= thresholds[0]) return 1
      if (v <= thresholds[1]) return 2
      if (v <= thresholds[2]) return 3
      return 4
    },
  }
}

// A full calendar year as a Mon→Sun pixel grid — the data behind the poster.
// `binary` (yes/no trackers) skips the ramp: any logged day is full intensity.
// Note: intensity always means *amount logged*, including for 'less' goals —
// on a "standard drinks" tracker the dark pixels are the heavy days. That's the
// honest reading of a magnitude heatmap; the UI legend says "less → more".
export function yearGrid(
  totals: DayTotals,
  year: number,
  opts: { since: string; today: string; binary?: boolean },
): YearGrid {
  const first = `${year}-01-01`
  const last = `${year}-12-31`
  const anchor = startOfWeek(first) // Monday of the week containing Jan 1

  const days = dayRange(first, last)
  const logged = days.map((d) => totals[d] ?? 0).filter((v) => v > 0)
  const ramp = levelRamp(opts.binary ? [] : logged)

  const monthCols: { month0: number; col: number }[] = []
  let total = 0
  let best: { day: string; total: number } | null = null

  const cells: YearCell[] = days.map((day) => {
    const value = totals[day] ?? 0
    const has = day in totals && value !== 0
    const d = fromDayKey(day)
    const col = Math.floor(daysFrom(anchor, day) / 7)
    const row = (d.getDay() + 6) % 7

    if (d.getDate() === 1) monthCols.push({ month0: d.getMonth(), col })
    if (value > 0) {
      total += value
      if (!best || value > best.total) best = { day, total: value }
    }

    return {
      day,
      total: value,
      logged: has,
      inRange: day >= opts.since && day <= opts.today,
      level: has ? (opts.binary ? 4 : ramp.levelOf(value)) : 0,
      col,
      row,
    }
  })

  return {
    year,
    cells,
    weeks: cells.length ? cells[cells.length - 1].col + 1 : 0,
    monthCols,
    thresholds: ramp.thresholds,
    loggedDays: logged.length,
    total,
    best,
  }
}

// Whole days between two day keys, local-midnight based (a small local copy of
// date.ts daysBetween so stats.ts keeps its single date import surface).
function daysFrom(a: string, b: string): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86_400_000)
}

// The years a tracker has any data in (plus the current year), newest first —
// the poster's year picker.
export function trackedYears(totals: DayTotals, today: string): number[] {
  const years = new Set<number>([Number(today.slice(0, 4))])
  for (const day of Object.keys(totals)) years.add(Number(day.slice(0, 4)))
  return [...years].sort((a, b) => b - a)
}
