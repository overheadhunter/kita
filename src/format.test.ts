import { describe, expect, it } from 'vitest'
import { dayLabel, hourLabel, relativeWeek, weekLabel } from './format'

describe('format', () => {
  it('labels days, weeks and hours in German', () => {
    expect(dayLabel('2026-11-09')).toEqual({ weekday: 'Mo', date: '9.11.' })
    expect(weekLabel('2026-12-28')).toBe('KW 53 · 28.12.–1.1.2027')
    expect(hourLabel(0)).toBe('07–08')
    expect(hourLabel(8)).toBe('15–16')
  })

  it('names weeks next to the current one', () => {
    expect(relativeWeek('2026-11-09', '2026-11-09')).toBe('diese Woche')
    expect(relativeWeek('2026-11-16', '2026-11-09')).toBe('nächste Woche')
    expect(relativeWeek('2026-11-02', '2026-11-09')).toBe('letzte Woche')
    expect(relativeWeek('2026-11-23', '2026-11-09')).toBeNull()
  })
})
