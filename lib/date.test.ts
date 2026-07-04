import { describe, it, expect } from 'vitest'
import { daysBetween, addDays, startOfWeek } from './date'

describe('daysBetween', () => {
  it('counts whole calendar days from a to b', () => {
    expect(daysBetween('2026-06-20', '2026-06-25')).toBe(5)
    expect(daysBetween('2026-06-25', '2026-06-25')).toBe(0)
  })
  it('is negative when a is after b', () => {
    expect(daysBetween('2026-06-25', '2026-06-20')).toBe(-5)
  })
  it('spans months and years', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2025-06-25', '2026-06-25')).toBe(365)
  })
  it('stays exact across a spring-forward DST boundary', () => {
    // US DST began 2026-03-08; a naive 24h-span count would drift by an hour.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
  it('agrees with addDays round-trips', () => {
    expect(daysBetween('2026-06-25', addDays('2026-06-25', 10))).toBe(10)
  })
})

describe('startOfWeek', () => {
  it('returns the Monday of the containing week', () => {
    // 2026-06-29 is a Monday; that whole week (through Sun 2026-07-05) maps to it.
    expect(startOfWeek('2026-06-29')).toBe('2026-06-29') // Monday → itself
    expect(startOfWeek('2026-07-03')).toBe('2026-06-29') // Friday
    expect(startOfWeek('2026-07-05')).toBe('2026-06-29') // Sunday (week's end)
    expect(startOfWeek('2026-07-06')).toBe('2026-07-06') // next Monday
  })
})
