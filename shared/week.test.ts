import { describe, expect, it } from 'vitest'
import { addWeeks, defaultWeek, isMonday, isoWeekNumber, mondayOf, today, weekdays } from './week'

describe('today', () => {
  it('uses Berlin time, not UTC', () => {
    // 23:30 UTC on Sunday is already Monday in Berlin (CET, UTC+1)
    expect(today(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09')
  })
})

describe('mondayOf', () => {
  it.each([
    ['2026-11-09', '2026-11-09'], // Monday
    ['2026-11-13', '2026-11-09'], // Friday
    ['2026-11-15', '2026-11-09'], // Sunday
    ['2027-01-01', '2026-12-28'], // across the year boundary
  ])('%s → %s', (date, monday) => expect(mondayOf(date)).toBe(monday))
})

describe('defaultWeek', () => {
  it.each([
    ['2026-11-09T08:00:00+01:00', '2026-11-09'], // Monday
    ['2026-11-13T18:00:00+01:00', '2026-11-09'], // Friday
    ['2026-11-14T00:30:00+01:00', '2026-11-16'], // just after midnight on Saturday
    ['2026-11-15T22:00:00+01:00', '2026-11-16'], // Sunday evening
    ['2026-11-13T23:30:00Z', '2026-11-16'], // Friday in UTC, but Saturday in Berlin
    ['2026-03-28T12:00:00+01:00', '2026-03-30'], // Saturday before the DST switch
  ])('%s → %s', (now, week) => expect(defaultWeek(new Date(now))).toBe(week))
})

describe('addWeeks', () => {
  it('moves forward and backward across DST and year boundaries', () => {
    expect(addWeeks('2026-03-23', 1)).toBe('2026-03-30')
    expect(addWeeks('2026-10-26', -1)).toBe('2026-10-19')
    expect(addWeeks('2026-12-28', 1)).toBe('2027-01-04')
  })
})

describe('isMonday', () => {
  it.each([
    ['2026-11-09', true],
    ['2026-11-10', false],
    ['2026-02-30', false],
    ['2026-11-9', false],
    ['x', false],
  ])('%s → %s', (value, expected) => expect(isMonday(value)).toBe(expected))
})

describe('weekdays', () => {
  it('lists Monday to Friday', () => {
    expect(weekdays('2026-12-28')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01'])
  })
})

describe('isoWeekNumber', () => {
  it.each([
    ['2026-11-09', 46],
    ['2026-12-28', 53],
    ['2027-01-04', 1],
  ])('%s → KW %i', (monday, week) => expect(isoWeekNumber(monday)).toBe(week))
})
