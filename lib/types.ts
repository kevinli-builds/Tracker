// Shared types for the tracker app.

export type TrackerType = 'yesno' | 'count'

// Whether logging more of this is "good", "bad", or neither. Drives how
// analytics frame a day (a green "good day" vs a red one) and nothing else.
export type GoalDirection = 'more' | 'less' | 'neutral'

export interface Tracker {
  id: string
  name: string
  type: TrackerType
  color: string
  emoji: string
  unit: string | null // e.g. "drinks", "glasses" — only meaningful for count
  goal_direction: GoalDirection
  sort_order: number
  archived: boolean
  created_at: string
}

// One logged tap. For a yes/no tracker there is at most one row per day.
// For a count tracker, each tap is a +1 row, so a day's total is SUM(value).
export interface Entry {
  id: string
  tracker_id: string
  day: string // local calendar date, 'YYYY-MM-DD'
  value: number
  logged_at: string
}

// A tracker's per-day totals, keyed by 'YYYY-MM-DD'.
export type DayTotals = Record<string, number>
