import { MAX_CHILDREN, MAX_FAMILY_NAME_LENGTH, isValidChildren } from '../shared/families'
import { removeChildrenFromCurrentWeek } from './anwesenheiten'
import { error, json, methodNotAllowed, notFound, readObject } from './http'

/** A family as listed for staff. */
export type Family = { id: number; name: string; token: string; children: number }

const CHILDREN_ERROR = `children must be an integer from 1 to ${MAX_CHILDREN}`

async function listFamilies(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT id, name, token, children FROM families ORDER BY name COLLATE NOCASE, id').all<Family>()
  return json(results)
}

async function addFamily(request: Request, env: Env): Promise<Response> {
  const body = await readObject(request)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name === '' || name.length > MAX_FAMILY_NAME_LENGTH) return error(400, `name must be 1 to ${MAX_FAMILY_NAME_LENGTH} characters`)
  // only a missing field defaults to one child; an explicit invalid value (including null) is an error
  const children = body && 'children' in body ? body.children : 1
  if (!isValidChildren(children)) return error(400, CHILDREN_ERROR)
  const family = await env.DB.prepare('INSERT INTO families (name, token, children, created_at) VALUES (?, ?, ?, ?) RETURNING id, name, token, children')
    .bind(name, crypto.randomUUID(), children, new Date().toISOString())
    .first<Family>()
  return json(family, 201)
}

async function updateFamily(request: Request, env: Env, id: number): Promise<Response> {
  const children = (await readObject(request))?.children
  if (!isValidChildren(children)) return error(400, CHILDREN_ERROR)
  const family = await env.DB.prepare('UPDATE families SET children = ? WHERE id = ? RETURNING id, name, token, children').bind(children, id).first<Family>()
  if (!family) return error(404, 'no such family')
  // children beyond the new count no longer appear in any tool, so their current and future entries must not count either; past weeks stay
  await removeChildrenFromCurrentWeek(env, id, children)
  return json(family)
}

async function removeFamily(env: Env, id: number): Promise<Response> {
  // the link stops working immediately; tool tables reference families with ON DELETE CASCADE, so the family's data goes with it
  const { meta } = await env.DB.prepare('DELETE FROM families WHERE id = ?').bind(id).run()
  return meta.changes > 0 ? new Response(null, { status: 204 }) : error(404, 'no such family')
}

/**
 * Handles `/api/families` and `/api/families/:id`; the caller must already be authenticated as staff.
 * @param request the incoming request
 * @param env the Worker environment
 * @param path the path after `/api/families`, e.g. `` or `/3`
 * @return the API response
 */
export function handleFamilies(request: Request, env: Env, path: string): Promise<Response> | Response {
  if (path === '') {
    if (request.method === 'GET') return listFamilies(env)
    if (request.method === 'POST') return addFamily(request, env)
    return methodNotAllowed()
  }
  const match = /^\/(\d+)$/.exec(path)
  if (!match) return notFound()
  const id = Number(match[1])
  if (request.method === 'PATCH') return updateFamily(request, env, id)
  if (request.method === 'DELETE') return removeFamily(env, id)
  return methodNotAllowed()
}
