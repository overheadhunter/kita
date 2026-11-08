// Site-wide authentication: one token per family (families table) and one for staff (STAFF_TOKEN secret), valid for every tool.

/** The caller's role, resolved from the Bearer token. */
export type Role = { role: 'family'; id: number; name: string; children: number } | { role: 'staff' }

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
  const family = await env.DB.prepare('SELECT id, name, children FROM families WHERE token = ?').bind(token).first<{ id: number; name: string; children: number }>()
  return family ? { role: 'family', ...family } : null
}
