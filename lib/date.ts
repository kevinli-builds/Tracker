// Local-date helpers. We key entries by the user's *local* calendar day
// (not UTC) so a tap at 11pm lands on today, not tomorrow.

// 'YYYY-MM-DD' for a Date in the local timezone.
export function toDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Today's local day key.
export function todayKey(): string {
  return toDayKey(new Date())
}

// Parse a 'YYYY-MM-DD' key into a local Date at midnight.
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Day key offset from a base key by `delta` days (delta may be negative).
export function addDays(key: string, delta: number): string {
  const d = fromDayKey(key)
  d.setDate(d.getDate() + delta)
  return toDayKey(d)
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthLabel(year: number, month0: number): string {
  return `${MONTHS[month0]} ${year}`
}

// All day keys in a given month (month0 is 0-indexed).
export function daysInMonth(year: number, month0: number): string[] {
  const count = new Date(year, month0 + 1, 0).getDate()
  const keys: string[] = []
  for (let d = 1; d <= count; d++) keys.push(toDayKey(new Date(year, month0, d)))
  return keys
}

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Friendly label for a day key: "Today", "Yesterday", or "Mon, Jun 16".
export function dayLabel(key: string): string {
  const today = todayKey()
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  const d = fromDayKey(key)
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}
