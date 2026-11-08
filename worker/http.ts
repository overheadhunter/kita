// Response helpers shared by all API modules.

/**
 * A JSON response that is never cached.
 * @param body the value to serialize
 * @param status the HTTP status
 * @return the response
 */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * A JSON error response `{ error }`.
 * @param status the HTTP status
 * @param message a short English description for developers
 * @return the response
 */
export function error(status: number, message: string): Response {
  return json({ error: message }, status)
}

/**
 * Parses the request body as a JSON object.
 * @param request the incoming request
 * @return the object, or `null` if the body is not a JSON object
 */
export async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const notFound = () => error(404, 'not found')
export const methodNotAllowed = () => error(405, 'method not allowed')
export const forbidden = () => error(403, 'forbidden')
