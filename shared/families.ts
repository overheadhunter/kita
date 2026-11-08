// Families are site-wide accounts: one secret link per family, valid for every tool.

/** Maximum length of a family's display name. */
export const MAX_FAMILY_NAME_LENGTH = 100

/** Maximum number of children per family. */
export const MAX_CHILDREN = 9

/**
 * Checks a children count from untrusted input.
 * @param value the parsed JSON value
 * @return whether it is an integer from 1 to {@link MAX_CHILDREN}
 */
export function isValidChildren(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_CHILDREN
}
