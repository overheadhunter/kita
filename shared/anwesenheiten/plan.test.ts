import { describe, expect, it } from 'vitest'
import { click, covers, emptyDays, validateDays, type DayState } from './plan'

const idle: DayState = { range: null, pending: null }

describe('click', () => {
  it('marks the start on the first click', () => {
    expect(click(idle, 1)).toEqual({ range: null, pending: 1 })
  })

  it('completes the range on the second click, including both slots', () => {
    expect(click({ range: null, pending: 1 }, 6)).toEqual({ range: { from: 8, to: 14 }, pending: null })
  })

  it('accepts the end before the start', () => {
    expect(click({ range: null, pending: 6 }, 1)).toEqual({ range: { from: 8, to: 14 }, pending: null })
  })

  it('selects a single hour when the same slot is clicked twice', () => {
    expect(click({ range: null, pending: 3 }, 3)).toEqual({ range: { from: 10, to: 11 }, pending: null })
  })

  it('starts over on the third click', () => {
    const done = click(click(idle, 0), 8)
    expect(done.range).toEqual({ from: 7, to: 16 })
    expect(click(done, 4)).toEqual({ range: null, pending: 4 })
  })
})

describe('covers', () => {
  it('includes from and excludes to', () => {
    const range = { from: 8, to: 10 }
    expect([0, 1, 2, 3].map((slot) => covers(range, slot))).toEqual([false, true, true, false])
    expect(covers(null, 0)).toBe(false)
  })
})

describe('validateDays', () => {
  it('accepts a valid week', () => {
    const days = [{ from: 7, to: 16 }, null, { from: 8, to: 9 }, null, null]
    expect(validateDays(days)).toEqual(days)
    expect(validateDays(emptyDays())).toEqual(emptyDays())
  })

  it.each([
    ['not an array', {}],
    ['too few days', [null, null, null, null]],
    ['too many days', [null, null, null, null, null, null]],
    ['before 07:00', [{ from: 6, to: 9 }, null, null, null, null]],
    ['after 16:00', [{ from: 8, to: 17 }, null, null, null, null]],
    ['empty range', [{ from: 9, to: 9 }, null, null, null, null]],
    ['reversed range', [{ from: 10, to: 9 }, null, null, null, null]],
    ['fractional hour', [{ from: 8.5, to: 9 }, null, null, null, null]],
    ['string hour', [{ from: '8', to: 9 }, null, null, null, null]],
    ['extra key', [{ from: 8, to: 9, x: 1 }, null, null, null, null]],
    ['number instead of range', [8, null, null, null, null]],
  ])('rejects %s', (_, value) => expect(validateDays(value)).toBeNull())
})
