import { FIRST_HOUR } from '../shared/plan'
import { addWeeks, isoWeekNumber } from '../shared/week'

// dates are calendar dates (`YYYY-MM-DD`), parsed as UTC midnight, so format them in UTC as well
const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' })
const dayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'UTC' })
const fullDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

/**
 * Column header for a weekday.
 * @param date the day as `YYYY-MM-DD`
 * @return e.g. `{ weekday: "Mo", date: "9.11." }`
 */
export function dayLabel(date: string): { weekday: string; date: string } {
  return { weekday: weekday.format(utc(date)).replace('.', ''), date: dayMonth.format(utc(date)) }
}

/**
 * Title of a week.
 * @param monday the week's Monday as `YYYY-MM-DD`
 * @return e.g. `KW 46 · 9.11.–13.11.2026`
 */
export function weekLabel(monday: string): string {
  const friday = new Date(utc(monday).getTime() + 4 * 24 * 60 * 60 * 1000)
  return `KW ${isoWeekNumber(monday)} · ${dayMonth.format(utc(monday))}–${fullDate.format(friday)}`
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
