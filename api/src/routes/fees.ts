import { Hono } from 'hono'
import { db } from '../db'
import { parseAmount, parseId, readBody } from '../http'
import { formatAmount, listEntries } from '../ledger'
import { actingMember, hasRole } from '../members'
import { DEFAULT_LABELS, isPriceKind, priceFor } from '../pricing'
import { toPrice, toTransaction } from '../serializers'
import type { AppEnv, Member, MemberWithUser, Price, Transaction } from '../types'

const fees = new Hono<AppEnv>()

fees.get('/groups/:id/prices', (c) => {
  const id = parseId(c.req.param('id'))
  const rows = db.prepare('SELECT * FROM prices WHERE group_id = ? ORDER BY kind LIMIT 1000').all(id) as Price[]
  return c.json({ prices: rows.map(toPrice) })
})

fees.put('/groups/:id/prices/:kind', async (c) => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const kind = c.req.param('kind')
  const me = actingMember(c)
  if (!hasRole(me, 'treasurer')) return c.json({ error: 'only the treasurer can set prices' }, 403)
  if (!isPriceKind(kind)) return c.json({ error: 'unknown price kind' }, 400)

  const body = await readBody<{ label: string; amount: number }>(c)
  const amount = parseAmount(body.amount)
  if (amount === null || amount < 0) return c.json({ error: 'amount must be a positive number of cents' }, 400)

  db.prepare(
    `INSERT INTO prices (group_id, kind, label, amount, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (group_id, kind) DO UPDATE SET
       label = excluded.label, amount = excluded.amount, updated_by = excluded.updated_by, updated_at = datetime('now')`,
  ).run(id, kind, body.label?.trim() || DEFAULT_LABELS[kind], amount, user.id)

  const price = db.prepare('SELECT * FROM prices WHERE group_id = ? AND kind = ?').get(id, kind) as Price
  return c.json({ price: toPrice(price) })
})

fees.delete('/groups/:id/prices/:kind', (c) => {
  const id = parseId(c.req.param('id'))
  const me = actingMember(c)
  if (!hasRole(me, 'treasurer')) return c.json({ error: 'only the treasurer can set prices' }, 403)

  db.prepare('DELETE FROM prices WHERE group_id = ? AND kind = ?').run(id, c.req.param('kind'))
  return c.json({ ok: true })
})

fees.get('/groups/:id/balances', (c) => {
  const id = parseId(c.req.param('id'))
  const me = actingMember(c)
  if (!hasRole(me, 'treasurer')) return c.json({ error: 'forbidden' }, 403)

  const rows = db
    .prepare(
      `SELECT m.*, u.name, u.email, u.avatar_color FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ?
       ORDER BY u.name
       LIMIT 1000`,
    )
    .all(id) as MemberWithUser[]

  const balances = rows.map((m) => ({
    memberId: m.id,
    userId: m.user_id,
    name: m.name,
    email: m.email,
    role: m.role,
    balance: m.balance,
    display: formatAmount(m.balance),
  }))
  const totalOutstanding = rows.reduce((sum, m) => sum + Math.max(m.balance, 0), 0)

  return c.json({ balances, totalOutstanding, total: balances.length })
})

fees.post('/groups/:id/members/:memberId/charges', async (c) => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const memberId = parseId(c.req.param('memberId'))
  const me = actingMember(c)
  if (!hasRole(me, 'treasurer')) return c.json({ error: 'forbidden' }, 403)

  const body = await readBody<{ amount: number; note: string }>(c)
  const amount = parseAmount(body.amount)
  if (!amount || amount <= 0) return c.json({ error: 'amount must be a positive number of cents' }, 400)

  db.prepare('UPDATE members SET balance = balance + ? WHERE id = ?').run(amount, memberId)
  db.prepare(
    "INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, 'charge', ?, ?, ?)",
  ).run(id, memberId, amount, body.note ?? '', user.id)

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as Member
  return c.json({ balance: member.balance }, 201)
})

fees.post('/groups/:id/members/:memberId/payments', async (c) => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const memberId = parseId(c.req.param('memberId'))
  const me = actingMember(c)
  if (!hasRole(me, 'treasurer')) return c.json({ error: 'forbidden' }, 403)

  const body = await readBody<{ amount: number; note: string }>(c)
  const amount = parseAmount(body.amount)
  if (!amount || amount <= 0) return c.json({ error: 'amount must be a positive number of cents' }, 400)

  db.prepare('UPDATE members SET balance = balance - ? WHERE id = ?').run(amount, memberId)
  db.prepare(
    "INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, 'payment', ?, ?, ?)",
  ).run(id, memberId, -amount, body.note || 'Payment received', user.id)

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId) as Member
  return c.json({ balance: member.balance }, 201)
})

fees.post('/groups/:id/dues', async (c) => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const me = actingMember(c)
  if (!hasRole(me, 'treasurer')) return c.json({ error: 'forbidden' }, 403)

  const rate = priceFor(id, 'monthly')
  if (!rate) return c.json({ ok: true, charged: 0 })

  const body = await readBody<{ note: string }>(c)
  const month = new Date().toLocaleString('en-IE', { month: 'long', year: 'numeric' })
  const note = body.note?.trim() || `Monthly dues, ${month}`

  const members = db.prepare('SELECT * FROM members WHERE group_id = ? LIMIT 1000').all(id) as Member[]
  for (const member of members) {
    db.prepare('UPDATE members SET balance = balance + ? WHERE id = ?').run(rate, member.id)
    db.prepare(
      "INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, 'charge', ?, ?, ?)",
    ).run(id, member.id, rate, note, user.id)
  }

  return c.json({ ok: true, charged: members.length, amount: rate })
})

fees.get('/members/:memberId/transactions', (c) => {
  const memberId = parseId(c.req.param('memberId'))
  const entries = listEntries(memberId)
  return c.json({ transactions: entries.map(toTransaction), total: entries.length })
})

fees.get('/transactions', (c) => {
  const user = c.get('user')
  const groupId = c.req.query('groupId')

  let rows: Transaction[]
  if (groupId) {
    rows = db
      .prepare(
        `SELECT t.* FROM transactions t
         JOIN members m ON m.id = t.member_id
         WHERE m.user_id = ? AND t.group_id = ?
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT 1000`,
      )
      .all(user.id, Number(groupId)) as Transaction[]
  } else {
    rows = db
      .prepare('SELECT * FROM transactions ORDER BY created_at DESC, id DESC LIMIT 1000')
      .all() as Transaction[]
  }

  const kind = c.req.query('kind')
  const list = kind ? rows.filter((t) => t.kind === kind) : rows
  return c.json({ transactions: list.map(toTransaction), total: list.length })
})

export default fees
