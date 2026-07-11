import { describe, it, expect } from 'vitest'
import type { DayTotals } from './types'
import {
  correlationFindings,
  fingerprint,
  streakSurvival,
  MIN_OVERLAP_DAYS,
  R_THRESHOLD,
  MIN_COMPLETED_STREAKS,
  dayRange,
  type TrackerSeries,
} from './stats'
import { addDays } from './date'

// Synthetic fixtures where the right answer is known by construction.

const START = '2026-01-05' // a Monday
const days = (n: number) => dayRange(START, addDays(START, n - 1))

function series(
  id: string,
  type: TrackerSeries['type'],
  totals: DayTotals,
  since = START,
): TrackerSeries {
  return { id, name: id, type, totals, since }
}

describe('correlationFindings (I1)', () => {
  const today = addDays(START, 39) // 40 observable days

  it('finds a perfect same-day correlation between two counts', () => {
    const a: DayTotals = {}
    const b: DayTotals = {}
    days(40).forEach((d, i) => {
      a[d] = i % 5 // varying counts
      b[d] = (i % 5) * 2 // exactly proportional
    })
    const f = correlationFindings([series('a', 'count', a), series('b', 'count', b)], today)
    const sameDay = f.find((x) => x.lag === 0)
    expect(sameDay).toBeDefined()
    expect(sameDay!.r).toBe(1)
    expect(sameDay!.n).toBe(40)
  })

  it('computes phi for two yesno trackers (2x2 known table)', () => {
    // 40 days: a and b agree on 32 (16 both-yes, 16 both-no), disagree on 8
    // (4 + 4). phi = (16*16 − 4*4) / sqrt(20*20*20*20) = 240/400 = 0.6.
    const a: DayTotals = {}
    const b: DayTotals = {}
    days(40).forEach((d, i) => {
      const cell = i % 10 // 0-3: both yes, 4: a only, 5: b only, 6-9: both no ×4 cycles
      if (cell <= 3) {
        a[d] = 1
        b[d] = 1
      } else if (cell === 4) {
        a[d] = 1
      } else if (cell === 5) {
        b[d] = 1
      }
    })
    const f = correlationFindings([series('a', 'yesno', a), series('b', 'yesno', b)], today)
    const sameDay = f.find((x) => x.lag === 0)
    expect(sameDay).toBeDefined()
    expect(sameDay!.r).toBeCloseTo(0.6, 2)
  })

  it('detects a lag-1 effect directionally: X today → Y tomorrow', () => {
    const x: DayTotals = {}
    const y: DayTotals = {}
    days(40).forEach((d, i) => {
      const v = i % 3
      x[d] = v
      y[addDays(d, 1)] = v * 3 // y mirrors x, one day later
    })
    const f = correlationFindings([series('x', 'count', x), series('y', 'count', y)], addDays(today, 1))
    const lagXY = f.find((c) => c.lag === 1 && c.aId === 'x' && c.bId === 'y')
    expect(lagXY).toBeDefined()
    expect(lagXY!.r).toBe(1)
  })

  it('reports nothing under the overlap guard', () => {
    const a: DayTotals = {}
    const b: DayTotals = {}
    days(MIN_OVERLAP_DAYS - 1).forEach((d, i) => {
      a[d] = i % 3
      b[d] = i % 3
    })
    const shortToday = addDays(START, MIN_OVERLAP_DAYS - 2)
    expect(correlationFindings([series('a', 'count', a), series('b', 'count', b)], shortToday)).toEqual([])
  })

  it('reports nothing for a constant series or a lopsided yesno', () => {
    const constant: DayTotals = {}
    const varied: DayTotals = {}
    const everyday: DayTotals = {}
    days(40).forEach((d, i) => {
      constant[d] = 2 // zero variance
      varied[d] = i % 4
      everyday[d] = 1 // yesno done every single day → degenerate phi
    })
    const f = correlationFindings(
      [series('c', 'count', constant), series('v', 'count', varied), series('e', 'yesno', everyday)],
      today,
    )
    expect(f).toEqual([])
  })

  it('excludes unread measure days instead of treating them as zero', () => {
    // Weight logged only on even days; count varies every day. On logged days
    // they match perfectly — missing weigh-ins must not dilute r to noise.
    const weight: DayTotals = {}
    const count: DayTotals = {}
    days(60).forEach((d, i) => {
      count[d] = i % 4
      if (i % 2 === 0) weight[d] = 70 + (i % 4)
    })
    const f = correlationFindings(
      [series('w', 'measure', weight), series('c', 'count', count)],
      addDays(START, 59),
    )
    const sameDay = f.find((x) => x.lag === 0)
    expect(sameDay).toBeDefined()
    expect(sameDay!.r).toBe(1)
    expect(sameDay!.n).toBe(30) // only the logged days count
  })

  it('honors the strength threshold', () => {
    // Nearly-independent series: r should land under R_THRESHOLD → no finding.
    const a: DayTotals = {}
    const b: DayTotals = {}
    days(40).forEach((d, i) => {
      a[d] = i % 2
      b[d] = i % 5 === 0 ? 3 : 0
    })
    const f = correlationFindings([series('a', 'count', a), series('b', 'count', b)], today)
    for (const c of f) expect(Math.abs(c.r)).toBeGreaterThanOrEqual(R_THRESHOLD)
  })
})

describe('fingerprint (I2)', () => {
  it('averages by weekday, Monday first, zeros counted for habits', () => {
    // 4 full Mon→Sun weeks starting Monday 2026-01-05; log 2 every Monday.
    const totals: DayTotals = {}
    for (let w = 0; w < 4; w++) totals[addDays(START, w * 7)] = 2
    const today = addDays(START, 27) // exactly 28 days
    const fp = fingerprint(totals, START, today, 'allDays')
    expect(fp.byWeekday[0]).toEqual({ count: 4, mean: 2 }) // Mondays
    expect(fp.byWeekday[6]).toEqual({ count: 4, mean: 0 }) // Sundays — zero days count
  })

  it('ignores unlogged days entirely in loggedDays mode (measures)', () => {
    const totals: DayTotals = { '2026-01-05': 70, '2026-01-12': 72 } // two Mondays
    const fp = fingerprint(totals, START, addDays(START, 27), 'loggedDays')
    expect(fp.byWeekday[0]).toEqual({ count: 2, mean: 71 })
    expect(fp.byWeekday[6]).toEqual({ count: 0, mean: 0 }) // no reading ≠ zero reading
  })

  it('buckets by calendar month', () => {
    const totals: DayTotals = { '2026-01-10': 3, '2026-02-10': 5 }
    const fp = fingerprint(totals, '2026-01-01', '2026-02-28', 'loggedDays')
    expect(fp.byMonth[0]).toEqual({ count: 1, mean: 3 })
    expect(fp.byMonth[1]).toEqual({ count: 1, mean: 5 })
  })
})

describe('streakSurvival (I3)', () => {
  // Build totals from a did/skip pattern string: 'x' = logged, '.' = not.
  function fromPattern(pattern: string): { totals: DayTotals; today: string } {
    const totals: DayTotals = {}
    pattern.split('').forEach((ch, i) => {
      if (ch === 'x') totals[addDays(START, i)] = 1
    })
    return { totals, today: addDays(START, pattern.length - 1) }
  }

  it('collects completed streaks and censors the ongoing one', () => {
    const { totals, today } = fromPattern('xxx.xx.xxxxx.xx') // completed 3,2,5; ongoing 2
    const s = streakSurvival(totals, 'did', today, START)
    expect(s.lengths).toEqual([3, 2, 5])
    expect(s.ongoing).toBe(2)
    expect(s.max).toBe(5)
  })

  it('holds back median/typicalEnd below the minimum sample', () => {
    const { totals, today } = fromPattern('xxx.xx.xxxxx.xx')
    const s = streakSurvival(totals, 'did', today, START)
    expect(s.lengths.length).toBeLessThan(MIN_COMPLETED_STREAKS)
    expect(s.median).toBeNull()
    expect(s.typicalEnd).toBeNull()
  })

  it('reports median, typical end, and a survival curve with enough history', () => {
    // Completed streaks: 3, 3, 5, 1, 3 → median 3, mode 3.
    const { totals, today } = fromPattern('xxx.xxx.xxxxx.x.xxx.')
    const s = streakSurvival(totals, 'did', today, START)
    expect(s.lengths).toEqual([3, 3, 5, 1, 3])
    expect(s.median).toBe(3)
    expect(s.typicalEnd).toBe(3)
    // Survival: ≥1: 100%, ≥2: 80%, ≥3: 80%, ≥4: 20%, ≥5: 20%
    expect(s.survival).toEqual([
      { day: 1, pct: 100 },
      { day: 2, pct: 80 },
      { day: 3, pct: 80 },
      { day: 4, pct: 20 },
      { day: 5, pct: 20 },
    ])
  })

  it('counts clean-day streaks for the skipped side', () => {
    const { totals, today } = fromPattern('..x..x...') // clean runs: 2, 2, then ongoing 3
    const s = streakSurvival(totals, 'skipped', today, START)
    expect(s.lengths).toEqual([2, 2])
    expect(s.ongoing).toBe(3)
  })
})
