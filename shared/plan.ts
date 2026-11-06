// A family's plan for one week: per weekday (Mon–Fri) either absent or a range of full hours.

/** First hour of the grid (07:00). */
export const FIRST_HOUR = 7
/** End of the last slot (16:00). */
export const LAST_HOUR = 16
/** Number of one-hour slots per day. */
export const SLOT_COUNT = LAST_HOUR - FIRST_HOUR
/** Number of days per week (Mon–Fri). */
export const DAY_COUNT = 5

/** Attendance on one day, in full hours; `to` is exclusive. */
export type DayRange = { from: number; to: number }

/** One entry per weekday, Monday first; `null` means the child is not there. */
export type Days = (DayRange | null)[]

/** Grid state of one day while the user is clicking: the saved range and, after the first click, the pending start slot. */
export type DayState = { range: DayRange | null; pending: number | null }

/**
 * A week without any attendance.
 * @return five `null` entries
 */
export function emptyDays(): Days {
  return Array.from({ length: DAY_COUNT }, () => null)
}

/**
 * Applies a click on a slot of one day. The first click marks the start, the second the end (in either order, both slots included), and any further click starts over as a first click.
 * @param state the day's state before the click
 * @param slot the clicked slot, 0 = 07:00–08:00
 * @return the day's state after the click
 */
export function click(state: DayState, slot: number): DayState {
  if (state.pending === null) return { range: null, pending: slot }
  return { range: { from: FIRST_HOUR + Math.min(state.pending, slot), to: FIRST_HOUR + Math.max(state.pending, slot) + 1 }, pending: null }
}

/**
 * Whether a slot lies within a range.
 * @param range the day's range, or `null`
 * @param slot the slot, 0 = 07:00–08:00
 * @return whether the child is there during that hour
 */
export function covers(range: DayRange | null, slot: number): boolean {
  if (!range) return false
  const hour = FIRST_HOUR + slot
  return hour >= range.from && hour < range.to
}

/**
 * Checks untrusted input (request bodies, database rows) against the {@link Days} shape.
 * @param value the parsed JSON
 * @return the value typed as {@link Days}, or `null` if it is malformed
 */
export function validateDays(value: unknown): Days | null {
  if (!Array.isArray(value) || value.length !== DAY_COUNT) return null
  const days: Days = []
  for (const day of value) {
    if (day === null) {
      days.push(null)
      continue
    }
    if (typeof day !== 'object' || Object.keys(day).length !== 2) return null
    const { from, to } = day as Record<string, unknown>
    if (!Number.isInteger(from) || !Number.isInteger(to)) return null
    const f = from as number
    const t = to as number
    if (f < FIRST_HOUR || t > LAST_HOUR || f >= t) return null
    days.push({ from: f, to: t })
  }
  return days
}

/** Upper bound for the staff-adjustable total number of families in the kindergarten. */
export const MAX_TOTAL_FAMILIES = 999

/** Maximum length of a family's display name. */
export const MAX_FAMILY_NAME_LENGTH = 100
