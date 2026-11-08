import { DAY_COUNT, SLOT_COUNT, covers, type Days } from './plan'

/** Number of children per weekday and hour slot: `counts[day][slot]`. */
export type Counts = number[][]

/**
 * Counts how many children are present in each hour of the week.
 * @param plans every family's plan for the week
 * @return `counts[day][slot]`, Monday and 07:00 first
 */
export function aggregate(plans: Days[]): Counts {
  return Array.from({ length: DAY_COUNT }, (_, day) =>
    Array.from({ length: SLOT_COUNT }, (_, slot) => plans.filter((days) => covers(days[day] ?? null, slot)).length),
  )
}
