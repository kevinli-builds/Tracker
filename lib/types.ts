// Shared types for the tracker app.

// 'yesno'   : done or not (≤1 entry/day)
// 'count'   : tally taps; a day's value is the SUM of its entries
// 'measure' : a free-form numeric reading per day, e.g. weight (latest replaces;
//             one entry per day, so the day's value is that single number)
// 'series'  : an ordered checklist of steps that resets daily (e.g. a routine);
//             a checked step is an entry tagged with step_id (day total = #done)
export type TrackerType = 'yesno' | 'count' | 'measure' | 'series'

// Whether logging more of this is "good", "bad", or neither. Drives how
// analytics frame a day (a green "good day" vs a red one) and the calendar tint.
export type GoalDirection = 'more' | 'less' | 'neutral'

// Which side of the behavior the streak counts. 'did' = consecutive days you
// logged it (total > 0); 'skipped' = consecutive clean days (total === 0).
// Independent of goal_direction so e.g. you can celebrate a "didn't" streak on a
// neutral counter, or a "did" streak on something you usually avoid.
export type StreakSide = 'did' | 'skipped'

// A collapsible group on the dashboard. Trackers reference it via section_id
// (null = ungrouped). collapsed is persisted so it syncs across devices.
export interface Section {
  id: string
  title: string
  sort_order: number
  collapsed: boolean
  created_at: string
}

// One step of a 'series' tracker's checklist.
export interface TrackerStep {
  id: string
  tracker_id: string
  label: string
  sort_order: number
  created_at: string
}

export interface Tracker {
  id: string
  section_id: string | null
  name: string
  subtitle: string | null // optional one-line description shown under the name
  type: TrackerType
  color: string
  emoji: string
  unit: string | null // e.g. "drinks", "glasses" — only meaningful for count
  goal_direction: GoalDirection
  streak_side: StreakSide
  sort_order: number
  archived: boolean
  created_at: string
}

// One logged tap. For a yes/no tracker there is at most one row per day.
// For a count tracker, each tap is a +1 row, so a day's total is SUM(value).
export interface Entry {
  id: string
  tracker_id: string
  step_id: string | null // set for a 'series' step check; null otherwise
  day: string // local calendar date, 'YYYY-MM-DD'
  value: number
  logged_at: string
}

// A tracker's per-day totals, keyed by 'YYYY-MM-DD'.
export type DayTotals = Record<string, number>

// Reference material attached to a tracker itself (not a specific day): a titled
// link (a doc URL), a free-text note, or an uploaded file (private Storage
// object). 'link' → `url`, 'note' → `body`, 'file' → `file_path`/`file_name`/
// `file_size`; `title` is an optional label for any of them.
export type ResourceKind = 'link' | 'note' | 'file'

export interface TrackerResource {
  id: string
  tracker_id: string
  kind: ResourceKind
  title: string | null
  url: string | null
  body: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  sort_order: number
  created_at: string
  updated_at: string
}
