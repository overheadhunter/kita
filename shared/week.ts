// Weeks are identified by the calendar date of their Monday (`YYYY-MM-DD`). All arithmetic happens on plain calendar dates in UTC, so DST never shifts a day.

export const TIME_ZONE = 'Europe/Berlin'

const DAY_MS = 24 * 60 * 60 * 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Today's calendar date in the kindergarten's time zone.
 * @param now the current instant
 * @return the date as `YYYY-MM-DD`
 */
export function today(now: Date): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * The Monday of the week containing the given date.
 * @param date a date as `YYYY-MM-DD`
 * @return that week's Monday as `YYYY-MM-DD`
 */
export function mondayOf(date: string): string {
  const d = parse(date)
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return format(new Date(d.getTime() - sinceMonday * DAY_MS))
}

/**
 * The week preselected when the app opens: the current week from Monday to Friday, the following week on Saturday and Sunday.
 * @param now the current instant
 * @return the week's Monday as `YYYY-MM-DD`
 */
export function defaultWeek(now: Date): string {
  const date = today(now)
  const weekday = parse(date).getUTCDay() // 0 = Sunday, 6 = Saturday
  const monday = mondayOf(date)
  return weekday === 0 || weekday === 6 ? addWeeks(monday, 1) : monday
}

/**
 * Shifts a date by whole weeks.
 * @param date a date as `YYYY-MM-DD`
 * @param weeks number of weeks, may be negative
 * @return the shifted date as `YYYY-MM-DD`
 */
export function addWeeks(date: string, weeks: number): string {
  return format(new Date(parse(date).getTime() + weeks * 7 * DAY_MS))
}

/**
 * Checks whether a string is a valid week key, i.e. a real calendar date that falls on a Monday.
 * @param value the candidate
 * @return whether it is a Monday as `YYYY-MM-DD`
 */
export function isMonday(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const d = parse(value)
  return !Number.isNaN(d.getTime()) && format(d) === value && d.getUTCDay() === 1
}

/**
 * The dates of Monday to Friday of a week.
 * @param monday the week's Monday as `YYYY-MM-DD`
 * @return five dates as `YYYY-MM-DD`
 */
export function weekdays(monday: string): string[] {
  const start = parse(monday).getTime()
  return Array.from({ length: 5 }, (_, i) => format(new Date(start + i * DAY_MS)))
}

/**
 * The ISO 8601 week number, for display only.
 * @param monday the week's Monday as `YYYY-MM-DD`
 * @return the week number (1–53)
 */
export function isoWeekNumber(monday: string): number {
  const thursday = new Date(parse(monday).getTime() + 3 * DAY_MS)
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1
}
