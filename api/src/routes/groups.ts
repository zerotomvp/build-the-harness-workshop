import { Hono } from 'hono'
import { db } from '../db'
import { parseId, readBody } from '../http'
import { actingMember, hasRole, ROLES } from '../members'
import { priceFor } from '../pricing'
import {
  toGroup,
  toJoinRequest,
  toMember,
  toMemberWithUser,
} from '../serializers'
import type {
  AppEnv,
  Group,
  JoinRequest,
  Member,
  MemberWithUser,
  Role,
} from '../types'

const groups = new Hono<AppEnv>()

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function findGroup(id: number) {
  return db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as
    Group | undefined
}

groups.get('/groups', c => {
  const user = c.get('user')
  const rows = db
    .prepare('SELECT * FROM groups ORDER BY name LIMIT 1000')
    .all() as Group[]
  const memberships = db
    .prepare('SELECT group_id, user_id FROM members LIMIT 1000')
    .all() as Pick<Member, 'group_id' | 'user_id'>[]

  const result = rows.map(group => {
    const groupMembers = memberships.filter(m => m.group_id === group.id)
    return {
      ...toGroup(group),
      memberCount: groupMembers.length,
      isMember: groupMembers.some(m => m.user_id === user.id),
    }
  })

  return c.json({ groups: result, total: result.length })
})

groups.post('/groups', async c => {
  const user = c.get('user')
  const body = await readBody<{
    name: string
    description: string
    visibility: string
  }>(c)
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'name is required' }, 400)

  const visibility = body.visibility === 'invite' ? 'invite' : 'open'
  let slug = slugify(name)
  if (db.prepare('SELECT id FROM groups WHERE slug = ?').get(slug)) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const result = db
    .prepare(
      'INSERT INTO groups (name, slug, description, visibility, created_by) VALUES (?, ?, ?, ?, ?)'
    )
    .run(name, slug, body.description ?? '', visibility, user.id)
  const groupId = Number(result.lastInsertRowid)
  db.prepare(
    "INSERT INTO members (group_id, user_id, role) VALUES (?, ?, 'admin')"
  ).run(groupId, user.id)
  db.prepare('INSERT INTO rooms (group_id, name) VALUES (?, ?)').run(
    groupId,
    name
  )

  return c.json({ group: toGroup(findGroup(groupId)!) }, 201)
})

groups.get('/groups/:id', c => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const group = findGroup(id)
  if (!group) return c.json({ error: 'group not found' }, 404)

  const members = db
    .prepare('SELECT * FROM members WHERE group_id = ? LIMIT 1000')
    .all(id) as Member[]
  const mine = members.find(m => m.user_id === user.id)
  const pending = db
    .prepare(
      "SELECT id FROM join_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'"
    )
    .get(id, user.id)

  return c.json({
    group: {
      ...toGroup(group),
      memberCount: members.length,
      membership: mine ? toMember(mine) : null,
      hasPendingRequest: !!pending,
    },
  })
})

groups.post('/groups/:id/join', async c => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const body = await readBody<{ isAccepted: boolean; message: string }>(c)
  const group = findGroup(id)
  if (!group) return c.json({ error: 'group not found' }, 404)

  const existing = db
    .prepare('SELECT * FROM members WHERE group_id = ? AND user_id = ?')
    .get(id, user.id) as Member | undefined
  if (existing) return c.json({ status: 'member', member: toMember(existing) })

  if (group.visibility === 'invite' && !body.isAccepted) {
    db.prepare(
      `INSERT INTO join_requests (group_id, user_id, message) VALUES (?, ?, ?)
       ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'pending', message = excluded.message`
    ).run(id, user.id, body.message ?? '')
    return c.json({ status: 'pending' }, 202)
  }

  const result = db
    .prepare(
      "INSERT INTO members (group_id, user_id, role) VALUES (?, ?, 'member')"
    )
    .run(id, user.id)
  const memberId = Number(result.lastInsertRowid)
  db.prepare(
    "UPDATE join_requests SET status = 'approved' WHERE group_id = ? AND user_id = ?"
  ).run(id, user.id)

  const fee = priceFor(id, 'joining')
  if (fee > 0) {
    db.prepare('UPDATE members SET balance = balance + ? WHERE id = ?').run(
      fee,
      memberId
    )
    db.prepare(
      "INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, 'charge', ?, ?, ?)"
    ).run(id, memberId, fee, 'Joining fee', user.id)
  }

  const member = db
    .prepare('SELECT * FROM members WHERE id = ?')
    .get(memberId) as Member
  return c.json({ status: 'member', member: toMember(member) }, 201)
})

groups.post('/groups/:id/leave', c => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  db.prepare('DELETE FROM members WHERE group_id = ? AND user_id = ?').run(
    id,
    user.id
  )
  return c.json({ ok: true })
})

groups.get('/groups/:id/members', c => {
  const id = parseId(c.req.param('id'))
  const role = c.req.query('role')
  const q = c.req.query('q')?.trim().toLowerCase()

  const rows = db
    .prepare(
      `SELECT m.*, u.name, u.email, u.avatar_color FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ?
       ORDER BY u.name
       LIMIT 1000`
    )
    .all(id) as MemberWithUser[]

  let list = rows
  if (role) list = list.filter(m => m.role === role)
  if (q)
    list = list.filter(
      m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    )

  return c.json({ members: list.map(toMemberWithUser), total: list.length })
})

groups.get('/groups/:id/requests', c => {
  const id = parseId(c.req.param('id'))
  const me = actingMember(c)
  if (!hasRole(me, 'admin')) return c.json({ error: 'forbidden' }, 403)

  const rows = db
    .prepare(
      `SELECT r.*, u.name, u.email FROM join_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.group_id = ?
       ORDER BY r.created_at
       LIMIT 1000`
    )
    .all(id) as (JoinRequest & { name: string; email: string })[]

  const pending = rows.filter(r => r.status === 'pending')
  return c.json({ requests: pending.map(toJoinRequest), total: pending.length })
})

groups.post('/groups/:id/requests/:requestId/approve', c => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const requestId = parseId(c.req.param('requestId'))
  const me = actingMember(c)
  if (!hasRole(me, 'admin')) return c.json({ error: 'forbidden' }, 403)

  const request = db
    .prepare('SELECT * FROM join_requests WHERE id = ?')
    .get(requestId) as JoinRequest | undefined
  if (!request) return c.json({ error: 'request not found' }, 404)

  db.prepare("UPDATE join_requests SET status = 'approved' WHERE id = ?").run(
    requestId
  )
  const result = db
    .prepare(
      "INSERT OR IGNORE INTO members (group_id, user_id, role) VALUES (?, ?, 'member')"
    )
    .run(id, request.user_id)

  if (result.changes > 0) {
    const memberId = Number(result.lastInsertRowid)
    const fee = priceFor(id, 'joining')
    if (fee > 0) {
      db.prepare('UPDATE members SET balance = balance + ? WHERE id = ?').run(
        fee,
        memberId
      )
      db.prepare(
        "INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, 'charge', ?, ?, ?)"
      ).run(id, memberId, fee, 'Joining fee', user.id)
    }
  }

  return c.json({ ok: true })
})

groups.post('/groups/:id/requests/:requestId/decline', c => {
  const requestId = parseId(c.req.param('requestId'))
  const me = actingMember(c)
  if (!hasRole(me, 'admin')) return c.json({ error: 'forbidden' }, 403)

  db.prepare("UPDATE join_requests SET status = 'declined' WHERE id = ?").run(
    requestId
  )
  return c.json({ ok: true })
})

groups.patch('/groups/:id/members/:memberId', async c => {
  const memberId = parseId(c.req.param('memberId'))
  const me = actingMember(c)
  if (!hasRole(me, 'admin')) return c.json({ error: 'forbidden' }, 403)

  const body = await readBody<{ role: Role }>(c)
  if (!body.role || !ROLES.includes(body.role))
    return c.json({ error: 'invalid role' }, 400)

  db.prepare('UPDATE members SET role = ? WHERE id = ?').run(
    body.role,
    memberId
  )
  const member = db
    .prepare('SELECT * FROM members WHERE id = ?')
    .get(memberId) as Member | undefined
  if (!member) return c.json({ error: 'member not found' }, 404)
  return c.json({ member: toMember(member) })
})

groups.delete('/groups/:id/members/:memberId', c => {
  const memberId = parseId(c.req.param('memberId'))
  const me = actingMember(c)
  if (!hasRole(me, 'admin')) return c.json({ error: 'forbidden' }, 403)

  db.prepare('DELETE FROM members WHERE id = ?').run(memberId)
  return c.json({ ok: true })
})

export default groups
