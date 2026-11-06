import type { Counts } from '../../shared/heatmap'
import type { Days } from '../../shared/plan'

export type Me = { role: 'family'; name: string } | { role: 'staff' }
export type Plan = { days: Days; source: 'saved' | 'prefill' | 'none' }
export type Heatmap = { counts: Counts; families: number; totalFamilies: number }
export type Family = { id: number; name: string; token: string }

/** An HTTP error from the API; `status` 401 means the link is not (or no longer) valid. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

const STORAGE_KEY = 'kita.token'

// the token comes from the URL fragment (`#t=…`), which browsers never send to the server, or else from the last visit; it travels only in the Authorization header
const fromUrl = new URLSearchParams(location.hash.slice(1)).get('t') || null
const token = fromUrl ?? localStorage.getItem(STORAGE_KEY)

/** Whether there is a token at all, from the URL or from an earlier visit. */
export const hasToken = token !== null

/** Remembers the current token for visits without `#t`; call once the server has accepted it. */
export function rememberToken() {
  if (token) localStorage.setItem(STORAGE_KEY, token)
}

/** Forgets a remembered token, e.g. after the server rejected it because the family was removed. */
export function forgetToken() {
  if (localStorage.getItem(STORAGE_KEY) === token) localStorage.removeItem(STORAGE_KEY)
}

/**
 * The personal link for a token.
 * @param familyToken the family's token
 * @return the absolute URL with `#t=…`
 */
export function linkFor(familyToken: string): string {
  return `${location.origin}/#t=${encodeURIComponent(familyToken)}`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status)
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const api = {
  me: () => request<Me>('GET', '/api/me'),
  getPlan: (week: string) => request<Plan>('GET', `/api/plans/${week}`),
  putPlan: (week: string, days: Days) => request<Plan>('PUT', `/api/plans/${week}`, { days }),
  getHeatmap: (week: string) => request<Heatmap>('GET', `/api/heatmap/${week}`),
  setTotalFamilies: (totalFamilies: number) => request<{ totalFamilies: number }>('PUT', '/api/settings', { totalFamilies }),
  listFamilies: () => request<Family[]>('GET', '/api/families'),
  addFamily: (name: string) => request<Family>('POST', '/api/families', { name }),
  removeFamily: (id: number) => request<void>('DELETE', `/api/families/${id}`),
}
