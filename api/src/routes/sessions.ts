import { Hono } from 'hono'
import { db } from '../db'
import { parseId, readBody } from '../http'
import { actingMember, hasRole } from '../members'
import { priceFor } from '../pricing'
import { toRsvp, toSession } from '../serializers'
import type { AppEnv, Rsvp, Session } from '../types'

const sessions = new Hono<AppEnv>()

type SessionRow = Session & { group_name: string }

function findSession(id: number) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    Session | undefined
}

sessions.get('/sessions', c => {
  const user = c.get('user')
  const groupId = c.req.query('groupId')
  const includePast = c.req.query('past') === '1'

  let rows: SessionRow[]
  if (groupId) {
    rows = db
      .prepare(
        `SELECT s.*, g.name AS group_name FROM sessions s
         JOIN groups g ON g.id = s.group_id
         JOIN members m ON m.group_id = s.group_id AND m.user_id = ?
         WHERE s.group_id = ?
         ORDER BY s.starts_at
         LIMIT 1000`
      )
      .all(user.id, Number(groupId)) as SessionRow[]
  } else {
    rows = db
      .prepare(
        `SELECT s.*, g.name AS group_name FROM sessions s
         JOIN groups g ON g.id = s.group_id
         ORDER BY s.starts_at
         LIMIT 1000`
      )
      .all() as SessionRow[]
  }

  const now = new Date().toISOString()
  const visible = includePast ? rows : rows.filter(s => s.starts_at >= now)
  const going = db
    .prepare(
      "SELECT session_id, user_id FROM rsvps WHERE status = 'going' LIMIT 1000"
    )
    .all() as Pick<Rsvp, 'session_id' | 'user_id'>[]

  const result = visible.map(s => {
    const sessionRsvps = going.filter(r => r.session_id === s.id)
    return {
      ...toSession(s),
      groupName: s.group_name,
      goingCount: sessionRsvps.length,
      isGoing: sessionRsvps.some(r => r.user_id === user.id),
    }
  })

  return c.json({ sessions: result, total: result.length })
})

sessions.post('/sessions', async c => {
  const user = c.get('user')
  const body = await readBody<{
    groupId: number
    title: string
    location: string
    startsAt: string
    capacity: number
  }>(c)
  const me = actingMember(c)
  if (!hasRole(me, 'admin')) return c.json({ error: 'forbidden' }, 403)

  const groupId = Number(body.groupId)
  const title = body.title?.trim()
  if (!groupId || !title || !body.startsAt) {
    return c.json({ error: 'groupId, title and startsAt are required' }, 400)
  }
  const startsAt = new Date(body.startsAt)
  if (Number.isNaN(startsAt.getTime()))
    return c.json({ error: 'invalid startsAt' }, 400)

  const result = db
    .prepare(
      'INSERT INTO sessions (group_id, title, location, starts_at, capacity, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      groupId,
      title,
      body.location ?? '',
      startsAt.toISOString(),
      body.capacity || null,
      user.id
    )

  const session = findSession(Number(result.lastInsertRowid))!
  return c.json({ session: toSession(session) }, 201)
})

sessions.get('/sessions/:id', c => {
  const id = parseId(c.req.param('id'))
  const session = findSession(id)
  if (!session) return c.json({ error: 'session not found' }, 404)
  return c.json({ session: toSession(session) })
})

sessions.delete('/sessions/:id', c => {
  const id = parseId(c.req.param('id'))
  const me = actingMember(c)
  if (!hasRole(me, 'admin')) return c.json({ error: 'forbidden' }, 403)

  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  return c.json({ ok: true })
})

sessions.get('/sessions/:id/attendees', c => {
  const id = parseId(c.req.param('id'))
  const rows = db
    .prepare(
      `SELECT r.*, u.name, u.avatar_color FROM rsvps r
       JOIN users u ON u.id = r.user_id
       WHERE r.session_id = ?
       ORDER BY r.created_at
       LIMIT 1000`
    )
    .all(id) as (Rsvp & { name: string; avatar_color: string })[]

  const attendees = rows
    .filter(r => r.status === 'going')
    .map(r => ({
      userId: r.user_id,
      name: r.name,
      avatarColor: r.avatar_color,
      status: r.status,
    }))

  return c.json({ attendees, total: attendees.length })
})

sessions.post('/sessions/:id/rsvp', c => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const session = findSession(id)
  if (!session) return c.json({ error: 'session not found' }, 404)

  const rsvps = db
    .prepare('SELECT * FROM rsvps WHERE session_id = ? LIMIT 1000')
    .all(id) as Rsvp[]
  const mine = rsvps.find(r => r.user_id === user.id)
  if (mine?.status === 'going')
    return c.json({ rsvp: toRsvp(mine), charged: 0 })

  const goingCount = rsvps.filter(r => r.status === 'going').length
  if (session.capacity && goingCount >= session.capacity) {
    return c.json({ error: 'session is full' }, 409)
  }

  if (mine) {
    db.prepare("UPDATE rsvps SET status = 'going' WHERE id = ?").run(mine.id)
  } else {
    db.prepare(
      "INSERT INTO rsvps (session_id, user_id, status) VALUES (?, ?, 'going')"
    ).run(id, user.id)
  }

  let charged = 0
  const price = priceFor(session.group_id, 'session')
  if (price > 0) {
    const member = db
      .prepare('SELECT id FROM members WHERE group_id = ? AND user_id = ?')
      .get(session.group_id, user.id) as { id: number } | undefined
    if (member) {
      db.prepare('UPDATE members SET balance = balance + ? WHERE id = ?').run(
        price,
        member.id
      )
      db.prepare(
        "INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, 'charge', ?, ?, ?)"
      ).run(session.group_id, member.id, price, session.title, user.id)
      charged = price
    }
  }

  const rsvp = db
    .prepare('SELECT * FROM rsvps WHERE session_id = ? AND user_id = ?')
    .get(id, user.id) as Rsvp
  return c.json({ rsvp: toRsvp(rsvp), charged }, 201)
})

sessions.delete('/sessions/:id/rsvp', c => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const session = findSession(id)
  if (!session) return c.json({ error: 'session not found' }, 404)

  const rsvp = db
    .prepare('SELECT * FROM rsvps WHERE session_id = ? AND user_id = ?')
    .get(id, user.id) as Rsvp | undefined
  if (!rsvp || rsvp.status !== 'going') return c.json({ ok: true, refunded: 0 })

  db.prepare("UPDATE rsvps SET status = 'cancelled' WHERE id = ?").run(rsvp.id)

  let refunded = 0
  const price = priceFor(session.group_id, 'session')
  if (price > 0) {
    const member = db
      .prepare('SELECT id FROM members WHERE group_id = ? AND user_id = ?')
      .get(session.group_id, user.id) as { id: number } | undefined
    if (member) {
      db.prepare('UPDATE members SET balance = balance - ? WHERE id = ?').run(
        price,
        member.id
      )
      db.prepare(
        "INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, 'refund', ?, ?, ?)"
      ).run(
        session.group_id,
        member.id,
        -price,
        `Cancelled: ${session.title}`,
        user.id
      )
      refunded = price
    }
  }

  return c.json({ ok: true, refunded })
})

export default sessions
