import { aggregate } from '../shared/heatmap'
import { MAX_FAMILY_NAME_LENGTH, MAX_TOTAL_FAMILIES, emptyDays, validateDays, type Days } from '../shared/plan'
import { addWeeks, isMonday } from '../shared/week'

/** The caller's role, resolved from the Bearer token. */
export type Role = { role: 'family'; id: number; name: string } | { role: 'staff' }

/** A family as listed for staff. */
export type Family = { id: number; name: string; token: string }

const encoder = new TextEncoder()

// hashing first makes both inputs the same length, as timingSafeEqual requires
async function tokenEquals(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([a, b].map((value) => crypto.subtle.digest('SHA-256', encoder.encode(value))))
  return crypto.subtle.timingSafeEqual(ha!, hb!)
}

/**
 * Resolves the Bearer token of a request to a role.
 * @param request the incoming request
 * @param env the Worker environment holding the STAFF_TOKEN secret and the families table
 * @return the role, or `null` if the token is missing or unknown
 */
export async function authenticate(request: Request, env: Env): Promise<Role | null> {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')
  if (!match) return null
  const token = match[1]!
  if (env.STAFF_TOKEN && (await tokenEquals(token, env.STAFF_TOKEN))) return { role: 'staff' }
  // family tokens are random UUIDs, so an indexed lookup leaks nothing useful through timing
  const family = await env.DB.prepare('SELECT id, name FROM families WHERE token = ?').bind(token).first<{ id: number; name: string }>()
  return family ? { role: 'family', id: family.id, name: family.name } : null
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function error(status: number, message: string): Response {
  return json({ error: message }, status)
}

// the parsed JSON body as a record, or `null` if it is not a JSON object
async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function loadDays(env: Env, familyId: number, week: string): Promise<Days | null> {
  const row = await env.DB.prepare('SELECT days FROM plans WHERE family_id = ? AND week = ?').bind(familyId, week).first<{ days: string }>()
  return row ? validateDays(JSON.parse(row.days)) : null
}

async function getPlan(env: Env, familyId: number, week: string): Promise<Response> {
  const saved = await loadDays(env, familyId, week)
  if (saved) return json({ days: saved, source: 'saved' })
  const previous = await loadDays(env, familyId, addWeeks(week, -1))
  if (previous) return json({ days: previous, source: 'prefill' })
  return json({ days: emptyDays(), source: 'none' })
}

async function putPlan(request: Request, env: Env, familyId: number, week: string): Promise<Response> {
  const days = validateDays((await readObject(request))?.days)
  if (!days) return error(400, 'invalid days')
  await env.DB.prepare(
    `INSERT INTO plans (family_id, week, days, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (family_id, week) DO UPDATE SET days = excluded.days, updated_at = excluded.updated_at`,
  )
    .bind(familyId, week, JSON.stringify(days), new Date().toISOString())
    .run()
  return json({ days, source: 'saved' })
}

// the number of families in the kindergarten; defaults to the number of families with a link until staff set it
async function totalFamilies(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'total_families'").first<{ value: string }>()
  const stored = row ? Number(row.value) : NaN
  if (Number.isInteger(stored) && stored > 0) return stored
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM families').first<number>('n')) ?? 0
}

async function getHeatmap(env: Env, week: string): Promise<Response> {
  const [{ results }, total] = await Promise.all([env.DB.prepare('SELECT days FROM plans WHERE week = ?').bind(week).all<{ days: string }>(), totalFamilies(env)])
  const plans = results.map((row) => validateDays(JSON.parse(row.days))).filter((days): days is Days => days !== null)
  return json({ counts: aggregate(plans), families: plans.length, totalFamilies: total })
}

async function putSettings(request: Request, env: Env): Promise<Response> {
  const total = (await readObject(request))?.totalFamilies
  if (!Number.isInteger(total) || (total as number) < 1 || (total as number) > MAX_TOTAL_FAMILIES) return error(400, `totalFamilies must be an integer from 1 to ${MAX_TOTAL_FAMILIES}`)
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('total_families', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
    .bind(String(total))
    .run()
  return json({ totalFamilies: total })
}

async function listFamilies(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT id, name, token FROM families ORDER BY name COLLATE NOCASE, id').all<Family>()
  return json(results)
}

async function addFamily(request: Request, env: Env): Promise<Response> {
  const name = (await readObject(request))?.name
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed === '' || trimmed.length > MAX_FAMILY_NAME_LENGTH) return error(400, `name must be 1 to ${MAX_FAMILY_NAME_LENGTH} characters`)
  const token = crypto.randomUUID()
  const family = await env.DB.prepare('INSERT INTO families (name, token, created_at) VALUES (?, ?, ?) RETURNING id, name, token')
    .bind(trimmed, token, new Date().toISOString())
    .first<Family>()
  return json(family, 201)
}

async function removeFamily(env: Env, id: string): Promise<Response> {
  // past plans stay, so past heatmaps do not change; the link stops working immediately
  const { meta } = await env.DB.prepare('DELETE FROM families WHERE id = ?').bind(Number(id)).run()
  return meta.changes > 0 ? new Response(null, { status: 204 }) : error(404, 'no such family')
}

async function handleStaff(request: Request, env: Env, pathname: string): Promise<Response | null> {
  if (pathname === '/api/settings') {
    return request.method === 'PUT' ? putSettings(request, env) : error(405, 'method not allowed')
  }
  if (pathname === '/api/families') {
    if (request.method === 'GET') return listFamilies(env)
    if (request.method === 'POST') return addFamily(request, env)
    return error(405, 'method not allowed')
  }
  const family = /^\/api\/families\/(\d+)$/.exec(pathname)
  if (family) {
    return request.method === 'DELETE' ? removeFamily(env, family[1]!) : error(405, 'method not allowed')
  }
  const heatmap = /^\/api\/heatmap\/([^/]+)$/.exec(pathname)
  if (heatmap) {
    if (!isMonday(heatmap[1]!)) return error(400, 'week must be a Monday as YYYY-MM-DD')
    return request.method === 'GET' ? getHeatmap(env, heatmap[1]!) : error(405, 'method not allowed')
  }
  return null
}

async function handleFamily(request: Request, env: Env, pathname: string, familyId: number): Promise<Response | null> {
  const plan = /^\/api\/plans\/([^/]+)$/.exec(pathname)
  if (!plan) return null
  const week = plan[1]!
  if (!isMonday(week)) return error(400, 'week must be a Monday as YYYY-MM-DD')
  if (request.method === 'GET') return getPlan(env, familyId, week)
  if (request.method === 'PUT') return putPlan(request, env, familyId, week)
  return error(405, 'method not allowed')
}

const STAFF_PATHS = /^\/api\/(settings|families|heatmap)(\/|$)/
const FAMILY_PATHS = /^\/api\/plans(\/|$)/

/**
 * Handles `/api/*`. Static assets never reach this, see `run_worker_first` in wrangler.jsonc.
 * @param request the incoming request
 * @param env the Worker environment
 * @return the API response
 */
export async function handle(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)
  const role = await authenticate(request, env)
  if (!role) return error(401, 'unknown link')

  if (pathname === '/api/me') {
    if (request.method !== 'GET') return error(405, 'method not allowed')
    return json(role.role === 'family' ? { role: 'family', name: role.name } : role)
  }

  if (role.role === 'staff') {
    if (FAMILY_PATHS.test(pathname)) return error(403, 'families only')
    return (await handleStaff(request, env, pathname)) ?? error(404, 'not found')
  }
  if (STAFF_PATHS.test(pathname)) return error(403, 'staff only')
  return (await handleFamily(request, env, pathname, role.id)) ?? error(404, 'not found')
}

export default {
  fetch: handle,
} satisfies ExportedHandler<Env>
