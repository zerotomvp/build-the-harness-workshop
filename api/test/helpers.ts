import { app } from '../src/app'
import { db, resetDatabase } from '../src/db'
import type { Role } from '../src/types'

export { db, resetDatabase }

export function createUser(name: string) {
  const email = `${name.toLowerCase()}@example.com`
  const result = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run(name, email)
  const id = Number(result.lastInsertRowid)
  const token = `token-${name.toLowerCase()}`
  db.prepare('INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)').run(token, id)
  return { id, name, email, token }
}

export function createGroup(name: string, visibility: 'open' | 'invite' = 'open') {
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  const result = db
    .prepare('INSERT INTO groups (name, slug, visibility) VALUES (?, ?, ?)')
    .run(name, slug, visibility)
  const id = Number(result.lastInsertRowid)
  db.prepare('INSERT INTO rooms (group_id, name) VALUES (?, ?)').run(id, name)
  return { id, name }
}

export function addMember(groupId: number, userId: number, role: Role = 'member', balance = 0) {
  const result = db
    .prepare('INSERT INTO members (group_id, user_id, role, balance) VALUES (?, ?, ?, ?)')
    .run(groupId, userId, role, balance)
  return Number(result.lastInsertRowid)
}

export function setPrice(groupId: number, kind: string, amount: number) {
  db.prepare('INSERT INTO prices (group_id, kind, label, amount) VALUES (?, ?, ?, ?)').run(groupId, kind, kind, amount)
}

export function createSession(groupId: number, title: string, daysAhead = 3) {
  const startsAt = new Date(Date.now() + daysAhead * 86_400_000).toISOString()
  const result = db
    .prepare('INSERT INTO sessions (group_id, title, starts_at) VALUES (?, ?, ?)')
    .run(groupId, title, startsAt)
  return Number(result.lastInsertRowid)
}

export function balanceOf(memberId: number) {
  const row = db.prepare('SELECT balance FROM members WHERE id = ?').get(memberId) as { balance: number }
  return row.balance
}

type RequestOptions = { body?: unknown; memberId?: number }

export async function call(method: string, path: string, token: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.memberId) headers['X-Member-Id'] = String(options.memberId)

  const res = await app.request(path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any
  return { status: res.status, data }
}
