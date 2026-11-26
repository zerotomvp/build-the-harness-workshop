import { Hono } from 'hono'
import { db } from '../db'
import { parseId, readBody } from '../http'
import { toMessage, toRoom } from '../serializers'
import type { AppEnv, Message, Room } from '../types'

const chat = new Hono<AppEnv>()

const lastMessageQuery = `SELECT msg.*, u.name AS user_name FROM messages msg
  JOIN users u ON u.id = msg.user_id
  WHERE msg.room_id = ?
  ORDER BY msg.id DESC
  LIMIT 1`

chat.get('/rooms', c => {
  const user = c.get('user')
  const groupId = c.req.query('groupId')

  let rooms: Room[]
  if (groupId) {
    rooms = db
      .prepare(
        `SELECT r.* FROM rooms r
         JOIN members m ON m.group_id = r.group_id AND m.user_id = ?
         WHERE r.group_id = ?
         LIMIT 1000`
      )
      .all(user.id, Number(groupId)) as Room[]
  } else {
    rooms = db
      .prepare('SELECT * FROM rooms ORDER BY name LIMIT 1000')
      .all() as Room[]
  }

  const result = rooms.map(room => {
    const last = db.prepare(lastMessageQuery).get(room.id) as
      Message | undefined
    return { ...toRoom(room), lastMessage: last ? toMessage(last) : null }
  })

  return c.json({ rooms: result })
})

chat.get('/rooms/:id/messages', c => {
  const id = parseId(c.req.param('id'))
  const after = Number(c.req.query('after') ?? 0)

  const rows = db
    .prepare(
      `SELECT msg.*, u.name AS user_name FROM messages msg
       JOIN users u ON u.id = msg.user_id
       WHERE msg.room_id = ?
       ORDER BY msg.id
       LIMIT 1000`
    )
    .all(id) as Message[]

  const messages = rows.filter(m => m.id > after).slice(-100)
  return c.json({ messages: messages.map(toMessage) })
})

chat.post('/rooms/:id/messages', async c => {
  const user = c.get('user')
  const id = parseId(c.req.param('id'))
  const body = await readBody<{ body: string }>(c)
  const text = body.body?.trim()
  if (!text) return c.json({ error: 'message body is required' }, 400)
  if (text.length > 2000) return c.json({ error: 'message is too long' }, 400)

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as
    Room | undefined
  if (!room) return c.json({ error: 'room not found' }, 404)

  const result = db
    .prepare('INSERT INTO messages (room_id, user_id, body) VALUES (?, ?, ?)')
    .run(id, user.id, text)
  const message = db
    .prepare(
      'SELECT msg.*, u.name AS user_name FROM messages msg JOIN users u ON u.id = msg.user_id WHERE msg.id = ?'
    )
    .get(Number(result.lastInsertRowid)) as Message
  return c.json({ message: toMessage(message) }, 201)
})

export default chat
