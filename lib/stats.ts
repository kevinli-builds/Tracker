// Pure analytics over a tracker's entries. No I/O — easy to unit-test.

import type { Entry, DayTotals, GoalDirection } from './types'
import { addDays } from './date'

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

// Consecutive good days ending today (walking backwards, no earlier than `since`).
export function currentStreak(
  totals: DayTotals,
  goal: GoalDirection,
  today: string,
  since: string,
): number {
  let streak = 0
  let cur = today
  while (cur >= since) {
    if (!isGoodDay(totals[cur] ?? 0, goal)) break
    streak++
    cur = addDays(cur, -1)
  }
  return streak
}

// Longest run of consecutive good days between `since` and `today` inclusive.
export function longestStreak(
  totals: DayTotals,
  goal: GoalDirection,
  today: string,
  since: string,
): number {
  let best = 0
  let run = 0
  for (const day of dayRange(since, today)) {
    if (isGoodDay(totals[day] ?? 0, goal)) {
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
    currentStreak: currentStreak(totals, goal, today, since),
    longestStreak: longestStreak(totals, goal, today, since),
    avgPerLoggedDay: daysLogged ? total / daysLogged : 0,
    last7: sumOver(7),
    last30: sumOver(30),
  }
}
