import { FIRST_HOUR } from '../../shared/anwesenheiten/plan'
import { addWeeks, isoWeekNumber, weekdays } from '../../shared/anwesenheiten/week'

// dates are calendar dates (`YYYY-MM-DD`), parsed as UTC midnight, so format the weekday in UTC as well
const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' })

// always two-digit day and month, e.g. `09.11.`
function dayMonth(date: string): string {
  const [, mm, dd] = date.split('-')
  return `${dd}.${mm}.`
}

/**
 * Column header for a weekday.
 * @param date the day as `YYYY-MM-DD`
 * @return e.g. `{ weekday: "Mo", date: "09.11." }`
 */
export function dayLabel(date: string): { weekday: string; date: string } {
  return { weekday: weekday.format(new Date(`${date}T00:00:00Z`)).replace('.', ''), date: dayMonth(date) }
}

/**
 * Title of a week.
 * @param monday the week's Monday as `YYYY-MM-DD`
 * @return e.g. `KW 46 • 09.11. - 13.11.2026`
 */
export function weekLabel(monday: string): string {
  const friday = weekdays(monday)[4]!
  return `KW ${isoWeekNumber(monday)} • ${dayMonth(monday)} - ${dayMonth(friday)}${friday.slice(0, 4)}`
}

/**
 * Row header for an hour slot.
 * @param slot the slot, 0 = 07:00–08:00
 * @return e.g. `07–08`
 */
export function hourLabel(slot: number): string {
  const pad = (hour: number) => String(hour).padStart(2, '0')
  return `${pad(FIRST_HOUR + slot)}–${pad(FIRST_HOUR + slot + 1)}`
}

/**
 * Describes a week relative to another one.
 * @param monday the displayed week's Monday
 * @param current the current (default) week's Monday
 * @return e.g. `diese Woche`, `nächste Woche`, or `null` for weeks further away
 */
export function relativeWeek(monday: string, current: string): string | null {
  if (monday === current) return 'diese Woche'
  if (monday === addWeeks(current, 1)) return 'nächste Woche'
  if (monday === addWeeks(current, -1)) return 'letzte Woche'
  return null
}
