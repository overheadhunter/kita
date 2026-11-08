import { describe, expect, it } from 'vitest'
import { aggregate } from './heatmap'

describe('aggregate', () => {
  it('returns zeros without plans', () => {
    const counts = aggregate([])
    expect(counts).toHaveLength(5)
    expect(counts.every((day) => day.length === 9 && day.every((n) => n === 0))).toBe(true)
  })

  it('counts overlapping ranges per hour', () => {
    const counts = aggregate([
      [{ from: 7, to: 10 }, null, null, null, { from: 15, to: 16 }],
      [{ from: 9, to: 12 }, null, null, null, null],
    ])
    expect(counts[0]).toEqual([1, 1, 2, 1, 1, 0, 0, 0, 0])
    expect(counts[1]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(counts[4]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1])
  })
})
