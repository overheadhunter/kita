import type { Counts } from '../../shared/anwesenheiten/heatmap'
import type { Days } from '../../shared/anwesenheiten/plan'

export type Role = 'family' | 'staff'
export type Me = { role: 'family'; name: string; children: number } | { role: 'staff' }
export type Plan = { days: Days; source: 'saved' | 'prefill' | 'none' }
export type Heatmap = { counts: Counts; families: number; totalFamilies: number }
export type Family = { id: number; name: string; token: string; children: number }

/** An HTTP error from the API; `status` 401 means the link is not (or no longer) valid. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

const STORAGE_KEY = 'kita.token'

// the token comes from the URL fragment (`#t=…`, on any page), which browsers never send to the server, or else from the last visit; it travels only in the Authorization header
const fromUrl = new URLSearchParams(location.hash.slice(1)).get('t') || null
const token = fromUrl ?? localStorage.getItem(STORAGE_KEY)

/** Whether there is a token at all, from the URL or from an earlier visit. */
export const hasToken = token !== null

/** Remembers the current token for visits without `#t`; call once the server has accepted it. */
export function rememberToken() {
  if (token) localStorage.setItem(STORAGE_KEY, token)
}

/**
 * Removes `#t=…` from the address bar, so a family cannot accidentally share its secret link when copying the URL of a page.
 * Keeps `history.state`, which vue-router relies on.
 */
export function stripTokenFromUrl() {
  if (!fromUrl) return
  const params = new URLSearchParams(location.hash.slice(1))
  params.delete('t')
  const hash = params.size ? `#${params}` : ''
  history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`)
}

/** Forgets a remembered token, e.g. after the server rejected it because the family was removed. */
export function forgetToken() {
  if (localStorage.getItem(STORAGE_KEY) === token) localStorage.removeItem(STORAGE_KEY)
}

/**
 * The personal link for a token; it opens the start page, from where all tools are reachable.
 * @param familyToken the family's token
 * @return the absolute URL with `#t=…`
 */
export function linkFor(familyToken: string): string {
  return `${location.origin}/#t=${encodeURIComponent(familyToken)}`
}

let onUnauthorized = () => {}

/**
 * Registers what happens when any API call answers 401 (see store/session.ts).
 * @param handler called once per rejected request
 */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401) onUnauthorized()
  if (!response.ok) throw new ApiError(response.status)
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const api = {
  me: () => request<Me>('GET', '/api/me'),
  families: {
    list: () => request<Family[]>('GET', '/api/families'),
    add: (name: string, children: number) => request<Family>('POST', '/api/families', { name, children }),
    setChildren: (id: number, children: number) => request<Family>('PATCH', `/api/families/${id}`, { children }),
    remove: (id: number) => request<void>('DELETE', `/api/families/${id}`),
  },
  anwesenheiten: {
    getPlans: (week: string) => request<{ children: Plan[] }>('GET', `/api/anwesenheiten/plans/${week}`),
    putPlan: (week: string, child: number, days: Days) => request<Plan>('PUT', `/api/anwesenheiten/plans/${week}/${child}`, { days }),
    getHeatmap: (week: string) => request<Heatmap>('GET', `/api/anwesenheiten/heatmap/${week}`),
  },
}
