import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { handle } from './index'

const FAMILY_A = 'token-a'
const FAMILY_B = 'token-b'
const STAFF = 'staff-token'
const WEEK = '2026-11-09'
const PREVIOUS = '2026-11-02'
const DAYS = [{ from: 8, to: 13 }, null, { from: 7, to: 16 }, null, { from: 9, to: 10 }]

function call(path: string, token?: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return handle(new Request(`https://kita.test${path}`, { ...init, headers }), env)
}

function put(week: string, token: string, days: unknown): Promise<Response> {
  return call(`/api/plans/${week}`, token, { method: 'PUT', body: JSON.stringify({ days }), headers: { 'Content-Type': 'application/json' } })
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM plans'),
    env.DB.prepare('DELETE FROM settings'),
    env.DB.prepare('DELETE FROM families'),
    env.DB.prepare("INSERT INTO families (name, token, created_at) VALUES ('Familie A', ?, '2026-01-01'), ('Familie B', ?, '2026-01-01')").bind(FAMILY_A, FAMILY_B),
  ])
})

type Family = { id: number; name: string; token: string }

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
}

async function families(): Promise<Family[]> {
  return (await call('/api/families', STAFF)).json()
}

function putSettings(token: string, body: unknown): Promise<Response> {
  return call('/api/settings', token, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}

async function heatmap(week = WEEK): Promise<{ counts: number[][]; families: number; totalFamilies: number }> {
  return (await call(`/api/heatmap/${week}`, STAFF)).json()
}

describe('authentication', () => {
  it.each([
    ['no header', undefined],
    ['unknown token', 'nope'],
    ['token prefix', 'token'],
  ])('rejects %s with 401', async (_, token) => {
    expect((await call('/api/me', token)).status).toBe(401)
  })

  it('resolves family tokens to their name', async () => {
    expect(await (await call('/api/me', FAMILY_A)).json()).toEqual({ role: 'family', name: 'Familie A' })
  })

  it('resolves the staff token', async () => {
    expect(await (await call('/api/me', STAFF)).json()).toEqual({ role: 'staff' })
  })

  it('keeps staff out of plans and families out of the heatmap', async () => {
    expect((await call(`/api/plans/${WEEK}`, STAFF)).status).toBe(403)
    expect((await call(`/api/heatmap/${WEEK}`, FAMILY_A)).status).toBe(403)
  })
})

describe('plans', () => {
  it('returns an empty week without data', async () => {
    expect(await (await call(`/api/plans/${WEEK}`, FAMILY_A)).json()).toEqual({ days: [null, null, null, null, null], source: 'none' })
  })

  it('stores and returns a plan', async () => {
    expect((await put(WEEK, FAMILY_A, DAYS)).status).toBe(200)
    expect(await (await call(`/api/plans/${WEEK}`, FAMILY_A)).json()).toEqual({ days: DAYS, source: 'saved' })
  })

  it('overwrites an existing plan', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    const changed = [null, null, null, null, { from: 7, to: 8 }]
    await put(WEEK, FAMILY_A, changed)
    expect(await (await call(`/api/plans/${WEEK}`, FAMILY_A)).json()).toEqual({ days: changed, source: 'saved' })
  })

  it('prefills from the previous week', async () => {
    await put(PREVIOUS, FAMILY_A, DAYS)
    expect(await (await call(`/api/plans/${WEEK}`, FAMILY_A)).json()).toEqual({ days: DAYS, source: 'prefill' })
  })

  it('does not prefill from older weeks', async () => {
    await put('2026-10-26', FAMILY_A, DAYS)
    expect(await (await call(`/api/plans/${WEEK}`, FAMILY_A)).json()).toMatchObject({ source: 'none' })
  })

  it('keeps families apart', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    expect(await (await call(`/api/plans/${WEEK}`, FAMILY_B)).json()).toMatchObject({ source: 'none' })
  })

  it.each([
    ['not a Monday', '2026-11-10'],
    ['not a date', 'latest'],
  ])('rejects a week that is %s', async (_, week) => {
    expect((await call(`/api/plans/${week}`, FAMILY_A)).status).toBe(400)
  })

  it('rejects invalid days', async () => {
    expect((await put(WEEK, FAMILY_A, [{ from: 6, to: 9 }, null, null, null, null])).status).toBe(400)
    expect((await call(`/api/plans/${WEEK}`, FAMILY_A, { method: 'PUT', body: 'not json' })).status).toBe(400)
  })
})

describe('heatmap', () => {
  it('counts children per hour without revealing names', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    await put(WEEK, FAMILY_B, [{ from: 12, to: 16 }, null, null, null, null])
    await put(PREVIOUS, FAMILY_B, DAYS) // other weeks do not count

    const response = await call(`/api/heatmap/${WEEK}`, STAFF)
    const text = await response.text()
    expect(text).not.toContain('Familie A')
    expect(text).not.toContain('Familie B')
    const { counts, families } = JSON.parse(text) as { counts: number[][]; families: number }
    expect(families).toBe(2)
    expect(counts[0]).toEqual([0, 1, 1, 1, 1, 2, 1, 1, 1])
    expect(counts[2]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(counts[1]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('total families', () => {
  it('defaults to the number of issued family links', async () => {
    expect((await heatmap()).totalFamilies).toBe(2)
  })

  it('can be changed by staff and is used from then on', async () => {
    expect((await putSettings(STAFF, { totalFamilies: 25 })).status).toBe(200)
    expect((await heatmap()).totalFamilies).toBe(25)
    await putSettings(STAFF, { totalFamilies: 30 })
    expect((await heatmap('2026-11-16')).totalFamilies).toBe(30)
  })

  it('cannot be changed by families', async () => {
    expect((await putSettings(FAMILY_A, { totalFamilies: 25 })).status).toBe(403)
  })

  it.each([0, -1, 2.5, '20', 1000, null])('rejects %s', async (value) => {
    expect((await putSettings(STAFF, { totalFamilies: value })).status).toBe(400)
  })
})

describe('families', () => {
  it('lists families with their tokens, sorted by name', async () => {
    await call('/api/families', STAFF, json('POST', { name: 'Aaron' }))
    const list = await families()
    expect(list.map((f) => f.name)).toEqual(['Aaron', 'Familie A', 'Familie B'])
    expect(list[1]!.token).toBe(FAMILY_A)
  })

  it('adds a family with a fresh UUID link that works immediately', async () => {
    const response = await call('/api/families', STAFF, json('POST', { name: '  Familie Müller ' }))
    expect(response.status).toBe(201)
    const added = (await response.json()) as Family
    expect(added.name).toBe('Familie Müller')
    expect(added.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(await (await call('/api/me', added.token)).json()).toEqual({ role: 'family', name: 'Familie Müller' })
  })

  it.each([['empty', ''], ['blank', '   '], ['too long', 'x'.repeat(101)], ['not a string', 42]])('rejects a %s name', async (_, name) => {
    expect((await call('/api/families', STAFF, json('POST', { name }))).status).toBe(400)
  })

  it('removes a family: the link stops working, past plans still count', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    const id = (await families()).find((f) => f.token === FAMILY_A)!.id
    expect((await call(`/api/families/${id}`, STAFF, { method: 'DELETE' })).status).toBe(204)
    expect((await call('/api/me', FAMILY_A)).status).toBe(401)
    expect((await heatmap()).families).toBe(1)
    expect((await call(`/api/families/${id}`, STAFF, { method: 'DELETE' })).status).toBe(404)
  })

  it('is managed by staff only', async () => {
    expect((await call('/api/families', FAMILY_A)).status).toBe(403)
    expect((await call('/api/families', FAMILY_A, json('POST', { name: 'X' }))).status).toBe(403)
    expect((await call('/api/families/1', FAMILY_A, { method: 'DELETE' })).status).toBe(403)
  })

  it('defines the default total', async () => {
    await call('/api/families', STAFF, json('POST', { name: 'C' }))
    expect((await heatmap()).totalFamilies).toBe(3)
  })
})
