import { db, resetDatabase } from './db'

const users = [
  { name: 'Alice Moreau', email: 'alice@hive.test', color: '#e76f51', token: 'dev-alice' },
  { name: 'Bob Okafor', email: 'bob@hive.test', color: '#2a9d8f', token: 'dev-bob' },
  { name: 'Carla Ruiz', email: 'carla@hive.test', color: '#e9c46a', token: 'dev-carla' },
  { name: 'Dev Patel', email: 'dev@hive.test', color: '#264653', token: 'dev-dev' },
  { name: 'Erin Walsh', email: 'erin@hive.test', color: '#8e7dbe', token: 'dev-erin' },
]

function daysFromNow(days: number, hour: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export function seed() {
  resetDatabase()

  const userIds: Record<string, number> = {}
  for (const u of users) {
    const result = db
      .prepare('INSERT INTO users (name, email, avatar_color) VALUES (?, ?, ?)')
      .run(u.name, u.email, u.color)
    const id = Number(result.lastInsertRowid)
    userIds[u.email.split('@')[0]] = id
    db.prepare('INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)').run(u.token, id)
  }
  const { alice, bob, carla, dev, erin } = userIds

  const insertGroup = db.prepare(
    'INSERT INTO groups (name, slug, description, visibility, created_by) VALUES (?, ?, ?, ?, ?)',
  )
  const runners = Number(
    insertGroup.run(
      'Riverside Runners',
      'riverside-runners',
      'Easy-paced group runs along the river, all levels welcome.',
      'open',
      alice,
    ).lastInsertRowid,
  )
  const chess = Number(
    insertGroup.run(
      'Thursday Night Chess',
      'thursday-night-chess',
      'Rated club games and blitz. New players join by invitation.',
      'invite',
      erin,
    ).lastInsertRowid,
  )

  const insertMember = db.prepare('INSERT INTO members (group_id, user_id, role, balance) VALUES (?, ?, ?, ?)')
  const members: Record<string, number> = {}
  const addMember = (key: string, groupId: number, userId: number, role: string, balance: number) => {
    members[key] = Number(insertMember.run(groupId, userId, role, balance).lastInsertRowid)
  }
  addMember('runners.alice', runners, alice, 'admin', 0)
  addMember('runners.bob', runners, bob, 'treasurer', 500)
  addMember('runners.carla', runners, carla, 'member', 3000)
  addMember('runners.dev', runners, dev, 'member', 2500)
  addMember('chess.erin', chess, erin, 'admin', 0)
  addMember('chess.dev', chess, dev, 'treasurer', 0)
  addMember('chess.alice', chess, alice, 'member', 1500)

  const insertPrice = db.prepare(
    'INSERT INTO prices (group_id, kind, label, amount, updated_by) VALUES (?, ?, ?, ?, ?)',
  )
  insertPrice.run(runners, 'session', 'Drop-in session', 500, bob)
  insertPrice.run(runners, 'monthly', 'Monthly dues', 2500, bob)
  insertPrice.run(chess, 'monthly', 'Club membership', 1500, dev)

  const insertTx = db.prepare(
    'INSERT INTO transactions (group_id, member_id, kind, amount, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
  )
  insertTx.run(runners, members['runners.bob'], 'charge', 2500, 'Monthly dues', bob)
  insertTx.run(runners, members['runners.bob'], 'payment', -2500, 'Bank transfer', bob)
  insertTx.run(runners, members['runners.bob'], 'charge', 500, 'Track intervals', bob)
  insertTx.run(runners, members['runners.carla'], 'charge', 2500, 'Monthly dues', bob)
  insertTx.run(runners, members['runners.carla'], 'charge', 500, 'Saturday long run', carla)
  insertTx.run(runners, members['runners.dev'], 'charge', 2500, 'Monthly dues', bob)
  insertTx.run(chess, members['chess.alice'], 'charge', 1500, 'Club membership', dev)

  const insertSession = db.prepare(
    'INSERT INTO sessions (group_id, title, location, starts_at, capacity, created_by) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const sessions = {
    pastRun: insertSession.run(runners, 'Saturday long run', 'Boathouse steps', daysFromNow(-5, 8), null, alice),
    longRun: insertSession.run(runners, 'Saturday long run', 'Boathouse steps', daysFromNow(2, 8), null, alice),
    intervals: insertSession.run(runners, 'Track intervals', 'City stadium track', daysFromNow(5, 19), 20, alice),
    hills: insertSession.run(runners, 'Hill repeats', 'Observatory hill', daysFromNow(9, 7), 12, alice),
    blitz: insertSession.run(chess, 'Blitz night', 'The Crown, back room', daysFromNow(3, 19), 16, erin),
    endgames: insertSession.run(chess, 'Endgame study', 'Library meeting room 2', daysFromNow(10, 18), 8, erin),
  }
  const sessionId = (key: keyof typeof sessions) => Number(sessions[key].lastInsertRowid)

  const insertRsvp = db.prepare("INSERT INTO rsvps (session_id, user_id, status) VALUES (?, ?, 'going')")
  insertRsvp.run(sessionId('pastRun'), carla)
  insertRsvp.run(sessionId('longRun'), alice)
  insertRsvp.run(sessionId('longRun'), dev)
  insertRsvp.run(sessionId('intervals'), bob)
  insertRsvp.run(sessionId('blitz'), erin)
  insertRsvp.run(sessionId('blitz'), alice)

  const insertRoom = db.prepare('INSERT INTO rooms (group_id, name) VALUES (?, ?)')
  const runnersRoom = Number(insertRoom.run(runners, 'Riverside Runners').lastInsertRowid)
  const chessRoom = Number(insertRoom.run(chess, 'Thursday Night Chess').lastInsertRowid)

  const insertMessage = db.prepare('INSERT INTO messages (room_id, user_id, body) VALUES (?, ?, ?)')
  insertMessage.run(runnersRoom, alice, 'Welcome everyone! Saturday long run is on, meet at the boathouse.')
  insertMessage.run(runnersRoom, carla, 'Is the pace still 6:00/km?')
  insertMessage.run(runnersRoom, alice, 'Yes, two groups: 6:00 and 5:30.')
  insertMessage.run(runnersRoom, bob, 'Reminder: monthly dues are due by Friday.')
  insertMessage.run(chessRoom, erin, 'Blitz night this Thursday, bring clocks if you have them.')
  insertMessage.run(chessRoom, dev, 'Club fees for the quarter are now on the board.')
  insertMessage.run(chessRoom, alice, 'Can someone lend me a clock?')

  return { users: users.length, groups: 2 }
}
