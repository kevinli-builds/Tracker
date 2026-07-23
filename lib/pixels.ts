// Shared presentation helpers for the Year-in-Pixels views (§4 D1): the
// per-tracker grid poster (components/YearPixels.tsx) and the all-trackers
// composite (components/YearComposite.tsx). Pure — no DOM, no I/O.

import type { YearLevel } from './stats'

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Level → opacity of the tracker's own colour. Level 0 is grey (see cellFill).
export const ALPHA: Record<Exclude<YearLevel, 0>, number> = { 1: 0.24, 2: 0.46, 3: 0.72, 4: 1 }

export const EMPTY_IN_RANGE = '#e7e7ea' // tracked that day, nothing logged
export const EMPTY_OUT_RANGE = '#f4f4f5' // outside the tracked window — not a zero

// '#rrggbb' (or '#rgb') + alpha → 'rgba(r, g, b, a)'. Colours come from our own
// palette (lib/constants COLORS), so a plain hex is the only shape to handle.
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// The fill for one day cell. An unlogged day inside the tracked window reads
// darker than one outside it: a day before you started isn't a zero.
export function cellFill(color: string, level: YearLevel, inRange: boolean): string {
  if (level === 0) return inRange ? EMPTY_IN_RANGE : EMPTY_OUT_RANGE
  return rgba(color, ALPHA[level])
}

// Filename stem for a downloaded poster: letters/digits/dashes only, so a
// tracker called "Weight (kg) 🏋️" can't produce a weird or unsafe filename.
export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tracker'
  )
}
