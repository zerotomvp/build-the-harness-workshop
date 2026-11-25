// npm run probe -- <name>: calls the running app (npm run dev) as one of its seeded people
// and prints what came back. It changes nothing it doesn't undo.
//
//   outsider-rsvp  Carla RSVPs to a Thursday Night Chess session, then cancels the RSVP.
//   room-list      Carla lists her chat rooms without choosing a group.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// better-sqlite3 is the API's dependency; load it from there.
const Database = createRequire(path.join(root, 'api', 'package.json'))('better-sqlite3')
const api = `http://localhost:${process.env.PORT ?? 3000}`
const CARLA = 'dev-carla'

async function call(method, route, token) {
  let res
  try {
    res = await fetch(api + route, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    })
  } catch {
    console.error(`The app isn't running at ${api}. Start it with npm run dev in another terminal, then run this again.`)
    process.exit(1)
  }
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: res.status, statusText: res.statusText, body }
}

// The probe looks up which session to use in the app's own database, read-only,
// so it doesn't depend on which routes the app offers.
function chessSession() {
  const file = path.resolve(root, 'api', process.env.DATABASE_PATH ?? 'hive.db')
  let db
  try {
    db = new Database(file, { readonly: true, fileMustExist: true })
  } catch {
    console.error(`No database at ${file}. Start the app once with npm run dev, then run this again.`)
    process.exit(1)
  }
  const row = db
    .prepare(
      `SELECT s.id, s.title FROM sessions s JOIN groups g ON g.id = s.group_id
       WHERE g.slug = 'thursday-night-chess'
       ORDER BY (s.starts_at < datetime('now')), s.starts_at LIMIT 1`,
    )
    .get()
  db.close()
  if (!row) {
    console.error('Thursday Night Chess has no sessions. Reset the sample data with npm run seed, then run this again.')
    process.exit(1)
  }
  return row
}

const probes = {
  async 'outsider-rsvp'() {
    const session = chessSession()
    console.log('Signed in as Carla Ruiz, a member of Riverside Runners only.')
    console.log(`RSVPing to "${session.title}", a session of Thursday Night Chess (invite-only).`)
    const r = await call('POST', `/sessions/${session.id}/rsvp`, CARLA)
    console.log(`\nThe app answered: ${r.status} ${r.statusText}`)
    console.log(r.status < 300 ? 'That status means the app accepted the RSVP.' : 'That status means the app refused the RSVP.')
    if (r.status < 300) {
      await call('DELETE', `/sessions/${session.id}/rsvp`, CARLA)
      console.log('(The probe then cancelled the RSVP, so you can run it again.)')
    }
  },

  async 'room-list'() {
    console.log('Signed in as Carla Ruiz, a member of Riverside Runners only.')
    console.log('Listing her chat rooms, without choosing a group.\n')
    const r = await call('GET', '/rooms', CARLA)
    if (r.status >= 300 || !Array.isArray(r.body?.rooms)) {
      console.log(`The app answered: ${r.status} ${r.statusText}`)
      return
    }
    if (r.body.rooms.length === 0) console.log('No rooms came back.')
    for (const room of r.body.rooms) {
      const last = room.lastMessage
      console.log(`- ${room.name}: ${last ? `latest message from ${last.userName ?? last.user_name ?? 'someone'}: "${last.body}"` : 'no messages'}`)
    }
  },
}

const name = process.argv[2]
if (!probes[name]) {
  console.error(`Usage: npm run probe -- <name>\nProbes: ${Object.keys(probes).join(', ')}`)
  process.exit(2)
}
await call('GET', '/health', CARLA) // fails early, with the hint, if the app isn't running
await probes[name]()
