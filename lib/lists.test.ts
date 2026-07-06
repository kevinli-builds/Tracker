import { describe, it, expect } from 'vitest'
import {
  normalizeColumns,
  normalizeItemValues,
  newColumn,
  templateColumns,
  LIST_TEMPLATES,
  COLUMN_TYPES,
} from './lists'

describe('normalizeColumns', () => {
  it('returns [] for non-array / junk input', () => {
    expect(normalizeColumns(null)).toEqual([])
    expect(normalizeColumns(undefined)).toEqual([])
    expect(normalizeColumns('nope')).toEqual([])
    expect(normalizeColumns({})).toEqual([])
  })

  it('drops columns without a string id', () => {
    const out = normalizeColumns([{ name: 'no id', type: 'text' }, { id: 'c1', name: 'Title', type: 'text' }, 'garbage'])
    expect(out).toEqual([{ id: 'c1', name: 'Title', type: 'text' }])
  })

  it('clamps unknown column types to text', () => {
    expect(normalizeColumns([{ id: 'c', name: 'X', type: 'wat' }])[0].type).toBe('text')
    for (const ty of COLUMN_TYPES) {
      expect(normalizeColumns([{ id: 'c', name: 'X', type: ty }])[0].type).toBe(ty)
    }
  })

  it('coerces a non-string name to empty string', () => {
    expect(normalizeColumns([{ id: 'c', name: 42, type: 'date' }])[0].name).toBe('')
  })
})

describe('normalizeItemValues', () => {
  it('returns {} for non-object input', () => {
    expect(normalizeItemValues(null)).toEqual({})
    expect(normalizeItemValues([1, 2])).toEqual({}) // arrays have no string entries here
  })

  it('keeps only string values', () => {
    expect(normalizeItemValues({ a: 'hi', b: 5, c: null, d: 'yo' })).toEqual({ a: 'hi', d: 'yo' })
  })
})

describe('templates & factories', () => {
  it('every template has at least one column', () => {
    for (const t of LIST_TEMPLATES) expect(t.columns.length).toBeGreaterThan(0)
  })

  it('templateColumns gives each column a fresh unique id', () => {
    const cols = templateColumns(LIST_TEMPLATES[0])
    expect(cols.length).toBe(LIST_TEMPLATES[0].columns.length)
    expect(new Set(cols.map((c) => c.id)).size).toBe(cols.length)
  })

  it('newColumn defaults to text type', () => {
    expect(newColumn('X').type).toBe('text')
    expect(newColumn('Y', 'number').type).toBe('number')
  })
})
