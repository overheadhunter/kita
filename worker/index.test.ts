import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { mondayOf, today } from '../shared/anwesenheiten/week'
import { handle } from './index'

const FAMILY_A = 'token-a'
const FAMILY_B = 'token-b'
const TWINS = 'token-twins' // a family with two children
const STAFF = 'staff-token'
const WEEK = '2026-11-09'
const PREVIOUS = '2026-11-02'
const DAYS = [{ from: 8, to: 13 }, null, { from: 7, to: 16 }, null, { from: 9, to: 10 }]
const EMPTY = [null, null, null, null, null]

function call(path: string, token?: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return handle(new Request(`https://kita.test${path}`, { ...init, headers }), env)
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
}

function put(week: string, token: string, days: unknown, child = 1): Promise<Response> {
  return call(`/api/anwesenheiten/plans/${week}/${child}`, token, json('PUT', { days }))
}

type ChildPlan = { days: unknown; source: string }

async function plans(week: string, token: string): Promise<ChildPlan[]> {
  return ((await (await call(`/api/anwesenheiten/plans/${week}`, token)).json()) as { children: ChildPlan[] }).children
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM anwesenheiten_plans'),
    env.DB.prepare('DELETE FROM families'),
    env.DB.prepare(
      "INSERT INTO families (name, token, children, created_at) VALUES ('Familie A', ?, 1, '2026-01-01'), ('Familie B', ?, 1, '2026-01-01'), ('Zwillinge', ?, 2, '2026-01-01')",
    ).bind(FAMILY_A, FAMILY_B, TWINS),
  ])
})

type Family = { id: number; name: string; token: string; children: number }

async function families(): Promise<Family[]> {
  return (await call('/api/families', STAFF)).json()
}

async function heatmap(week = WEEK): Promise<{ counts: number[][]; families: number; totalFamilies: number }> {
  return (await call(`/api/anwesenheiten/heatmap/${week}`, STAFF)).json()
}

describe('authentication', () => {
  it.each([
    ['no header', undefined],
    ['unknown token', 'nope'],
    ['token prefix', 'token'],
  ])('rejects %s with 401', async (_, token) => {
    expect((await call('/api/me', token)).status).toBe(401)
  })

  it('resolves family tokens to their name and number of children', async () => {
    expect(await (await call('/api/me', FAMILY_A)).json()).toEqual({ role: 'family', name: 'Familie A', children: 1 })
    expect(await (await call('/api/me', TWINS)).json()).toEqual({ role: 'family', name: 'Zwillinge', children: 2 })
  })

  it('resolves the staff token', async () => {
    expect(await (await call('/api/me', STAFF)).json()).toEqual({ role: 'staff' })
  })

  it('keeps staff out of plans and families out of the heatmap', async () => {
    expect((await call(`/api/anwesenheiten/plans/${WEEK}`, STAFF)).status).toBe(403)
    expect((await put(WEEK, STAFF, DAYS)).status).toBe(403)
    expect((await call(`/api/anwesenheiten/heatmap/${WEEK}`, FAMILY_A)).status).toBe(403)
  })
})

describe('plans', () => {
  it('returns one empty week per child without data', async () => {
    expect(await plans(WEEK, FAMILY_A)).toEqual([{ days: EMPTY, source: 'none' }])
    expect(await plans(WEEK, TWINS)).toEqual([
      { days: EMPTY, source: 'none' },
      { days: EMPTY, source: 'none' },
    ])
  })

  it('stores and returns a plan', async () => {
    expect((await put(WEEK, FAMILY_A, DAYS)).status).toBe(200)
    expect(await plans(WEEK, FAMILY_A)).toEqual([{ days: DAYS, source: 'saved' }])
  })

  it('overwrites an existing plan', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    const changed = [null, null, null, null, { from: 7, to: 8 }]
    await put(WEEK, FAMILY_A, changed)
    expect(await plans(WEEK, FAMILY_A)).toEqual([{ days: changed, source: 'saved' }])
  })

  it('keeps children apart, each with its own prefill', async () => {
    const second = [null, { from: 7, to: 9 }, null, null, null]
    await put(PREVIOUS, TWINS, DAYS, 1)
    await put(PREVIOUS, TWINS, second, 2)
    await put(WEEK, TWINS, EMPTY, 2)
    expect(await plans(WEEK, TWINS)).toEqual([
      { days: DAYS, source: 'prefill' },
      { days: EMPTY, source: 'saved' },
    ])
  })

  it('rejects child numbers the family does not have', async () => {
    expect((await put(WEEK, FAMILY_A, DAYS, 2)).status).toBe(404)
    expect((await put(WEEK, TWINS, DAYS, 3)).status).toBe(404)
    expect((await put(WEEK, TWINS, DAYS, 0)).status).toBe(404)
  })

  it('prefills from the previous week', async () => {
    await put(PREVIOUS, FAMILY_A, DAYS)
    expect(await plans(WEEK, FAMILY_A)).toEqual([{ days: DAYS, source: 'prefill' }])
  })

  it('does not prefill from older weeks', async () => {
    await put('2026-10-26', FAMILY_A, DAYS)
    expect(await plans(WEEK, FAMILY_A)).toEqual([{ days: EMPTY, source: 'none' }])
  })

  it('keeps families apart', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    expect(await plans(WEEK, FAMILY_B)).toEqual([{ days: EMPTY, source: 'none' }])
  })

  it.each([
    ['not a Monday', '2026-11-10'],
    ['not a date', 'latest'],
  ])('rejects a week that is %s', async (_, week) => {
    expect((await call(`/api/anwesenheiten/plans/${week}`, FAMILY_A)).status).toBe(400)
  })

  it('rejects invalid days', async () => {
    expect((await put(WEEK, FAMILY_A, [{ from: 6, to: 9 }, null, null, null, null])).status).toBe(400)
    expect((await call(`/api/anwesenheiten/plans/${WEEK}/1`, FAMILY_A, { method: 'PUT', body: 'not json' })).status).toBe(400)
  })

  it('only accepts PUT for a single child and GET for the whole week', async () => {
    expect((await call(`/api/anwesenheiten/plans/${WEEK}`, FAMILY_A, json('PUT', { days: DAYS }))).status).toBe(405)
    expect((await call(`/api/anwesenheiten/plans/${WEEK}/1`, FAMILY_A)).status).toBe(405)
  })
})

describe('heatmap', () => {
  it('counts children per hour without revealing names', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    await put(WEEK, FAMILY_B, [{ from: 12, to: 16 }, null, null, null, null])
    await put(PREVIOUS, FAMILY_B, DAYS) // other weeks do not count

    const response = await call(`/api/anwesenheiten/heatmap/${WEEK}`, STAFF)
    const text = await response.text()
    expect(text).not.toContain('Familie A')
    expect(text).not.toContain('Familie B')
    const { counts, families } = JSON.parse(text) as { counts: number[][]; families: number }
    expect(families).toBe(2)
    expect(counts[0]).toEqual([0, 1, 1, 1, 1, 2, 1, 1, 1])
    expect(counts[2]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(counts[1]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('counts every child, but each family only once for the confidence value', async () => {
    await put(WEEK, TWINS, DAYS, 1)
    await put(WEEK, TWINS, DAYS, 2)
    const { counts, families } = await heatmap()
    expect(families).toBe(1)
    expect(counts[0]![1]).toBe(2)
  })
})

describe('children per family', () => {
  it('can be set when adding a family, defaulting to 1', async () => {
    const one = (await (await call('/api/families', STAFF, json('POST', { name: 'Eins' }))).json()) as Family
    const three = (await (await call('/api/families', STAFF, json('POST', { name: 'Drei', children: 3 }))).json()) as Family
    expect([one.children, three.children]).toEqual([1, 3])
  })

  it.each([0, 10, 1.5, '2', null])('rejects %s children', async (children) => {
    expect((await call('/api/families', STAFF, json('POST', { name: 'X', children }))).status).toBe(400)
    const id = (await families())[0]!.id
    expect((await call(`/api/families/${id}`, STAFF, json('PATCH', { children }))).status).toBe(400)
  })

  it('can be changed by staff and applies to the family immediately', async () => {
    const id = (await families()).find((f) => f.token === FAMILY_A)!.id
    const response = await call(`/api/families/${id}`, STAFF, json('PATCH', { children: 2 }))
    expect(await response.json()).toMatchObject({ id, children: 2 })
    expect(await plans(WEEK, FAMILY_A)).toHaveLength(2)
    expect((await put(WEEK, FAMILY_A, DAYS, 2)).status).toBe(200)
  })

  it('drops entries of removed children from the current week on, but keeps past weeks', async () => {
    const current = mondayOf(today(new Date()))
    const past = '2020-01-06'
    await put(past, TWINS, DAYS, 2)
    await put(current, TWINS, DAYS, 2)
    const id = (await families()).find((f) => f.token === TWINS)!.id
    await call(`/api/families/${id}`, STAFF, json('PATCH', { children: 1 }))
    expect((await heatmap(past)).counts[0]![1]).toBe(1)
    expect((await heatmap(current)).counts[0]![1]).toBe(0)
  })

  it('is managed by staff only', async () => {
    expect((await call('/api/families/1', FAMILY_A, json('PATCH', { children: 2 }))).status).toBe(403)
  })

  it('answers 404 for unknown families', async () => {
    expect((await call('/api/families/99999', STAFF, json('PATCH', { children: 2 }))).status).toBe(404)
  })
})

describe('total families', () => {
  it('is the number of families configured on /verwaltung and follows changes immediately', async () => {
    expect((await heatmap()).totalFamilies).toBe(3)
    const added = (await (await call('/api/families', STAFF, json('POST', { name: 'Neu' }))).json()) as Family
    expect((await heatmap()).totalFamilies).toBe(4)
    await call(`/api/families/${added.id}`, STAFF, { method: 'DELETE' })
    expect((await heatmap()).totalFamilies).toBe(3)
  })

  it('cannot be set through the API any more', async () => {
    expect((await call('/api/anwesenheiten/settings', STAFF, json('PUT', { totalFamilies: 25 }))).status).toBe(404)
  })
})

describe('families', () => {
  it('lists families with their tokens, sorted by name', async () => {
    await call('/api/families', STAFF, json('POST', { name: 'Aaron' }))
    const list = await families()
    expect(list.map((f) => f.name)).toEqual(['Aaron', 'Familie A', 'Familie B', 'Zwillinge'])
    expect(list[1]!.token).toBe(FAMILY_A)
  })

  it('adds a family with a fresh UUID link that works immediately', async () => {
    const response = await call('/api/families', STAFF, json('POST', { name: '  Familie Müller ' }))
    expect(response.status).toBe(201)
    const added = (await response.json()) as Family
    expect(added.name).toBe('Familie Müller')
    expect(added.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(await (await call('/api/me', added.token)).json()).toEqual({ role: 'family', name: 'Familie Müller', children: 1 })
  })

  it.each([['empty', ''], ['blank', '   '], ['too long', 'x'.repeat(101)], ['not a string', 42]])('rejects a %s name', async (_, name) => {
    expect((await call('/api/families', STAFF, json('POST', { name }))).status).toBe(400)
  })

  it('removes a family: the link stops working and all its plans are gone, past weeks included', async () => {
    await put(WEEK, FAMILY_A, DAYS)
    await put(PREVIOUS, FAMILY_A, DAYS)
    await put(WEEK, FAMILY_B, DAYS)
    const id = (await families()).find((f) => f.token === FAMILY_A)!.id
    expect((await call(`/api/families/${id}`, STAFF, { method: 'DELETE' })).status).toBe(204)
    expect((await call('/api/me', FAMILY_A)).status).toBe(401)
    expect((await heatmap()).families).toBe(1)
    expect((await heatmap(PREVIOUS)).families).toBe(0)
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM anwesenheiten_plans WHERE family_id = ?').bind(id).first<number>('n')
    expect(left).toBe(0)
    expect((await call(`/api/families/${id}`, STAFF, { method: 'DELETE' })).status).toBe(404)
  })

  it('is managed by staff only', async () => {
    expect((await call('/api/families', FAMILY_A)).status).toBe(403)
    expect((await call('/api/families', FAMILY_A, json('POST', { name: 'X' }))).status).toBe(403)
    expect((await call('/api/families/1', FAMILY_A, { method: 'DELETE' })).status).toBe(403)
  })
})

describe('routing', () => {
  it.each(['/api/unknown', '/api/anwesenheiten', '/api/anwesenheiten/nope/2026-11-09', '/api/families/abc'])('answers %s with 404', async (path) => {
    expect((await call(path, STAFF)).status).toBe(404)
  })

  it('authenticates before routing, so unknown paths do not reveal anything', async () => {
    expect((await call('/api/unknown', 'nope')).status).toBe(401)
  })
})
