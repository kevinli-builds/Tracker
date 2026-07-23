import { describe, it, expect } from 'vitest'
import { rgba, cellFill, slug, EMPTY_IN_RANGE, EMPTY_OUT_RANGE } from './pixels'

describe('rgba', () => {
  it('expands a 6-digit hex', () => {
    expect(rgba('#22c55e', 0.24)).toBe('rgba(34, 197, 94, 0.24)')
  })
  it('expands a 3-digit hex', () => {
    expect(rgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)')
  })
  it('works without the leading hash', () => {
    expect(rgba('000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})

describe('cellFill', () => {
  it('greys level 0, darker inside the tracked window than outside', () => {
    expect(cellFill('#22c55e', 0, true)).toBe(EMPTY_IN_RANGE)
    expect(cellFill('#22c55e', 0, false)).toBe(EMPTY_OUT_RANGE)
    expect(EMPTY_IN_RANGE).not.toBe(EMPTY_OUT_RANGE)
  })
  it('ramps opacity for levels 1..4, ending fully opaque', () => {
    expect(cellFill('#22c55e', 1, true)).toBe('rgba(34, 197, 94, 0.24)')
    expect(cellFill('#22c55e', 4, true)).toBe('rgba(34, 197, 94, 1)')
  })
  it('ignores the range flag once something was logged', () => {
    expect(cellFill('#22c55e', 3, false)).toBe(cellFill('#22c55e', 3, true))
  })
})

describe('slug', () => {
  it('lowercases and dashes a normal name', () => {
    expect(slug('Went outside')).toBe('went-outside')
  })
  it('strips punctuation and emoji, without leaving edge dashes', () => {
    expect(slug('Weight (kg) 🏋️')).toBe('weight-kg')
  })
  it('falls back when nothing survives', () => {
    expect(slug('🌱🌱')).toBe('tracker')
    expect(slug('')).toBe('tracker')
  })
  it('caps the length', () => {
    expect(slug('a'.repeat(80)).length).toBe(40)
  })
})
