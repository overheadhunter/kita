import { handleAnwesenheiten } from './anwesenheiten'
import { authenticate } from './auth'
import { handleFamilies } from './families'
import { error, forbidden, json, methodNotAllowed, notFound } from './http'

/**
 * Handles `/api/*`: authenticates the caller, then dispatches to the site-wide endpoints or a tool's module. Static assets never reach this, see `run_worker_first` in wrangler.jsonc.
 * @param request the incoming request
 * @param env the Worker environment
 * @return the API response
 */
export async function handle(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)
  const role = await authenticate(request, env)
  if (!role) return error(401, 'unknown link')

  if (pathname === '/api/me') {
    if (request.method !== 'GET') return methodNotAllowed()
    return json(role.role === 'family' ? { role: 'family', name: role.name, children: role.children } : role)
  }

  // `/api/<module>` or `/api/<module>/…`
  const route = /^\/api\/([a-z]+)(\/.*)?$/.exec(pathname)
  if (!route) return notFound()
  const [, module, rest = ''] = route as unknown as [string, string, string | undefined]
  switch (module) {
    case 'families':
      return role.role === 'staff' ? handleFamilies(request, env, rest) : forbidden()
    case 'anwesenheiten':
      return handleAnwesenheiten(request, env, rest, role)
    default:
      return notFound()
  }
}

export default {
  fetch: handle,
} satisfies ExportedHandler<Env>
