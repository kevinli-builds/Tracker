import { describe, it, expect } from 'vitest'
import type { DayTotals } from './types'
import { yearGrid, trackedYears } from './stats'

// 2026 starts on a Thursday, so Jan 1 sits at row 3 (Mon=0) of week column 0.
const OPTS = { since: '2026-01-01', today: '2026-12-31' }

describe('yearGrid — shape', () => {
  it('emits every day of the year in date order', () => {
    const g = yearGrid({}, 2026, OPTS)
    expect(g.cells).toHaveLength(365)
    expect(g.cells[0].day).toBe('2026-01-01')
    expect(g.cells[364].day).toBe('2026-12-31')
  })

  it('counts the leap day', () => {
    const g = yearGrid({}, 2028, { since: '2028-01-01', today: '2028-12-31' })
    expect(g.cells).toHaveLength(366)
    expect(g.cells.some((c) => c.day === '2028-02-29')).toBe(true)
  })

  it('places Jan 1 2026 on Thursday of the first week column', () => {
    const g = yearGrid({}, 2026, OPTS)
    expect(g.cells[0]).toMatchObject({ col: 0, row: 3 })
  })

  it('starts a new column each Monday', () => {
    const g = yearGrid({}, 2026, OPTS)
    const jan4 = g.cells.find((c) => c.day === '2026-01-04')! // Sunday
    const jan5 = g.cells.find((c) => c.day === '2026-01-05')! // Monday
    expect(jan4).toMatchObject({ col: 0, row: 6 })
    expect(jan5).toMatchObject({ col: 1, row: 0 })
  })

  it('spans 53 week columns in 2026 and records each month start', () => {
    const g = yearGrid({}, 2026, OPTS)
    expect(g.weeks).toBe(53)
    expect(g.monthCols).toHaveLength(12)
    expect(g.monthCols[0]).toEqual({ month0: 0, col: 0 })
    expect(g.monthCols[11].month0).toBe(11)
  })
})

describe('yearGrid — range', () => {
  it('marks days outside [since, today] as out of range (untracked, not zeros)', () => {
    const g = yearGrid({}, 2026, { since: '2026-03-01', today: '2026-06-15' })
    const feb = g.cells.find((c) => c.day === '2026-02-28')!
    const mar = g.cells.find((c) => c.day === '2026-03-01')!
    const jul = g.cells.find((c) => c.day === '2026-07-01')!
    expect(feb.inRange).toBe(false)
    expect(mar.inRange).toBe(true)
    expect(jul.inRange).toBe(false)
  })
})

describe('yearGrid — levels', () => {
  it('binary trackers: any logged day is full intensity', () => {
    const totals: DayTotals = { '2026-01-02': 1, '2026-01-03': 5 }
    const g = yearGrid(totals, 2026, { ...OPTS, binary: true })
    expect(g.cells.find((c) => c.day === '2026-01-02')!.level).toBe(4)
    expect(g.cells.find((c) => c.day === '2026-01-03')!.level).toBe(4)
    expect(g.cells.find((c) => c.day === '2026-01-04')!.level).toBe(0)
    expect(g.thresholds).toEqual([])
  })

  it('a single distinct value reads as full intensity, not level 1', () => {
    const totals: DayTotals = { '2026-01-02': 1, '2026-01-05': 1, '2026-02-09': 1 }
    const g = yearGrid(totals, 2026, OPTS)
    expect(g.cells.filter((c) => c.level === 4)).toHaveLength(3)
    expect(g.thresholds).toEqual([])
  })

  it('two distinct values map to levels 2 and 4', () => {
    const totals: DayTotals = { '2026-01-02': 1, '2026-01-03': 3 }
    const g = yearGrid(totals, 2026, OPTS)
    expect(g.cells.find((c) => c.day === '2026-01-02')!.level).toBe(2)
    expect(g.cells.find((c) => c.day === '2026-01-03')!.level).toBe(4)
  })

  it('four distinct values fill levels 1..4 in order', () => {
    const totals: DayTotals = {
      '2026-01-02': 1,
      '2026-01-03': 2,
      '2026-01-04': 3,
      '2026-01-05': 9,
    }
    const g = yearGrid(totals, 2026, OPTS)
    const lv = (d: string) => g.cells.find((c) => c.day === d)!.level
    expect([lv('2026-01-02'), lv('2026-01-03'), lv('2026-01-04'), lv('2026-01-05')]).toEqual([
      1, 2, 3, 4,
    ])
  })

  it('more than four distinct values use quartiles of the logged days', () => {
    // Eight readings 1..8: quartile cuts land on 2, 4, 6 (index floor of p*(n-1)).
    const totals: DayTotals = {}
    for (let i = 1; i <= 8; i++) totals[`2026-01-0${i}`] = i
    const g = yearGrid(totals, 2026, OPTS)
    expect(g.thresholds).toEqual([2, 4, 6])
    const lv = (d: string) => g.cells.find((c) => c.day === d)!.level
    expect(lv('2026-01-01')).toBe(1) // ≤2
    expect(lv('2026-01-02')).toBe(1)
    expect(lv('2026-01-03')).toBe(2) // ≤4
    expect(lv('2026-01-05')).toBe(3) // ≤6
    expect(lv('2026-01-07')).toBe(4) // above
    expect(lv('2026-01-08')).toBe(4)
  })

  it('ignores days from other years when building the ramp', () => {
    const totals: DayTotals = { '2025-06-01': 500, '2026-01-02': 1, '2026-01-03': 2 }
    const g = yearGrid(totals, 2026, OPTS)
    expect(g.total).toBe(3)
    expect(g.loggedDays).toBe(2)
    expect(g.cells.find((c) => c.day === '2026-01-03')!.level).toBe(4)
  })
})

describe('yearGrid — summary stats', () => {
  it('totals only the selected year and finds the best day', () => {
    const totals: DayTotals = { '2026-02-01': 2, '2026-02-02': 7, '2026-03-05': 4 }
    const g = yearGrid(totals, 2026, OPTS)
    expect(g.total).toBe(13)
    expect(g.loggedDays).toBe(3)
    expect(g.best).toEqual({ day: '2026-02-02', total: 7 })
  })

  it('an empty year has no best day and no logged days', () => {
    const g = yearGrid({}, 2026, OPTS)
    expect(g.best).toBeNull()
    expect(g.loggedDays).toBe(0)
    expect(g.total).toBe(0)
    expect(g.cells.every((c) => c.level === 0)).toBe(true)
  })

  it('treats an explicit zero as unlogged, not as a level', () => {
    const g = yearGrid({ '2026-04-01': 0 }, 2026, OPTS)
    const cell = g.cells.find((c) => c.day === '2026-04-01')!
    expect(cell.logged).toBe(false)
    expect(cell.level).toBe(0)
    expect(g.loggedDays).toBe(0)
  })
})

describe('trackedYears', () => {
  it('lists data years plus the current one, newest first', () => {
    const totals: DayTotals = { '2024-05-01': 1, '2026-01-01': 1 }
    expect(trackedYears(totals, '2026-07-23')).toEqual([2026, 2024])
  })

  it('always includes the current year even with no data', () => {
    expect(trackedYears({}, '2026-07-23')).toEqual([2026])
  })
})
