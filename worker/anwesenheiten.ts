import { aggregate } from '../shared/anwesenheiten/heatmap'
import { emptyDays, validateDays, type Days } from '../shared/anwesenheiten/plan'
import { addWeeks, isMonday, mondayOf, today } from '../shared/anwesenheiten/week'
import type { Role } from './auth'
import { error, forbidden, json, methodNotAllowed, notFound, readObject } from './http'

type ChildPlan = { days: Days; source: 'saved' | 'prefill' | 'none' }

/**
 * Deletes the entries of children a family no longer has (child numbers above `children`) from the current week on; past weeks stay as they were.
 * @param env the Worker environment
 * @param familyId the family
 * @param children the family's new number of children
 */
export async function removeChildrenFromCurrentWeek(env: Env, familyId: number, children: number): Promise<void> {
  await env.DB.prepare('DELETE FROM anwesenheiten_plans WHERE family_id = ? AND child > ? AND week >= ?')
    .bind(familyId, children, mondayOf(today(new Date())))
    .run()
}

// all children's saved days of one family in one week, keyed by child number
async function loadWeek(env: Env, familyId: number, week: string): Promise<Map<number, Days>> {
  const { results } = await env.DB.prepare('SELECT child, days FROM anwesenheiten_plans WHERE family_id = ? AND week = ?')
    .bind(familyId, week)
    .all<{ child: number; days: string }>()
  const byChild = new Map<number, Days>()
  for (const row of results) {
    const days = validateDays(JSON.parse(row.days))
    if (days) byChild.set(row.child, days)
  }
  return byChild
}

async function getPlans(env: Env, familyId: number, children: number, week: string): Promise<Response> {
  const [saved, previous] = await Promise.all([loadWeek(env, familyId, week), loadWeek(env, familyId, addWeeks(week, -1))])
  // each child separately: saved for this week, else a prefill from the previous week, else empty
  const plans: ChildPlan[] = Array.from({ length: children }, (_, i) => {
    const child = i + 1
    const own = saved.get(child)
    if (own) return { days: own, source: 'saved' }
    const prefill = previous.get(child)
    if (prefill) return { days: prefill, source: 'prefill' }
    return { days: emptyDays(), source: 'none' }
  })
  return json({ children: plans })
}

async function putPlan(request: Request, env: Env, familyId: number, child: number, week: string): Promise<Response> {
  const days = validateDays((await readObject(request))?.days)
  if (!days) return error(400, 'invalid days')
  await env.DB.prepare(
    `INSERT INTO anwesenheiten_plans (family_id, child, week, days, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (family_id, child, week) DO UPDATE SET days = excluded.days, updated_at = excluded.updated_at`,
  )
    .bind(familyId, child, week, JSON.stringify(days), new Date().toISOString())
    .run()
  return json({ days, source: 'saved' } satisfies ChildPlan)
}

async function getHeatmap(env: Env, week: string): Promise<Response> {
  const [{ results }, totalFamilies] = await Promise.all([
    env.DB.prepare('SELECT family_id, days FROM anwesenheiten_plans WHERE week = ?').bind(week).all<{ family_id: number; days: string }>(),
    // all families configured on /verwaltung
    env.DB.prepare('SELECT COUNT(*) AS n FROM families').first<number>('n'),
  ])
  // counts are per child; the confidence value is per family, since families enter data for all their children at once
  const plans = results.map((row) => validateDays(JSON.parse(row.days))).filter((days): days is Days => days !== null)
  const families = new Set(results.map((row) => row.family_id)).size
  return json({ counts: aggregate(plans), families, totalFamilies: totalFamilies ?? 0 })
}

/**
 * Handles `/api/anwesenheiten/*`.
 * @param request the incoming request
 * @param env the Worker environment
 * @param path the path after `/api/anwesenheiten`, e.g. `/plans/2026-11-09` or `/plans/2026-11-09/2`
 * @param role the authenticated caller
 * @return the API response
 */
export function handleAnwesenheiten(request: Request, env: Env, path: string, role: Role): Promise<Response> | Response {
  const heatmap = /^\/heatmap\/([^/]+)$/.exec(path)
  if (heatmap) {
    if (role.role !== 'staff') return forbidden()
    if (!isMonday(heatmap[1]!)) return error(400, 'week must be a Monday as YYYY-MM-DD')
    return request.method === 'GET' ? getHeatmap(env, heatmap[1]!) : methodNotAllowed()
  }

  // GET /plans/:week returns all children, PUT /plans/:week/:child saves one
  const plans = /^\/plans\/([^/]+)(?:\/(\d+))?$/.exec(path)
  if (!plans) return notFound()
  if (role.role !== 'family') return forbidden()
  const [, week, child] = plans as unknown as [string, string, string | undefined]
  if (!isMonday(week)) return error(400, 'week must be a Monday as YYYY-MM-DD')
  if (child === undefined) {
    return request.method === 'GET' ? getPlans(env, role.id, role.children, week) : methodNotAllowed()
  }
  const n = Number(child)
  if (n < 1 || n > role.children) return error(404, 'no such child')
  return request.method === 'PUT' ? putPlan(request, env, role.id, n, week) : methodNotAllowed()
}
