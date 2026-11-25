import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { db } from '../db'
import { readBody } from '../http'
import { toUser } from '../serializers'
import type { AppEnv, Group, Member, User } from '../types'

const auth = new Hono<AppEnv>()

auth.post('/auth/login', async (c) => {
  const body = await readBody<{ email: string }>(c)
  const email = body.email?.trim().toLowerCase()
  if (!email) return c.json({ error: 'email is required' }, 400)

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined
  if (!user) return c.json({ error: 'no account for that email' }, 404)

  const token = randomUUID()
  db.prepare('INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)').run(token, user.id)
  return c.json({ token, user: toUser(user) })
})

auth.post('/auth/logout', (c) => {
  const header = c.req.header('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(token)
  return c.json({ ok: true })
})

auth.get('/me', (c) => {
  const user = c.get('user')
  const rows = db
    .prepare(
      `SELECT m.*, g.name AS group_name FROM members m
       JOIN groups g ON g.id = m.group_id
       WHERE m.user_id = ?
       ORDER BY g.name
       LIMIT 1000`,
    )
    .all(user.id) as (Member & { group_name: Group['name'] })[]

  return c.json({
    user: toUser(user),
    memberships: rows.map((m) => ({
      memberId: m.id,
      groupId: m.group_id,
      groupName: m.group_name,
      role: m.role,
      balance: m.balance,
    })),
  })
})

export default auth
