import Database from 'better-sqlite3'
import { schema } from './schema'

const file = process.env.DATABASE_PATH ?? 'hive.db'

export const db = new Database(file)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(schema)

const tables = [
  'messages',
  'rooms',
  'transactions',
  'prices',
  'rsvps',
  'sessions',
  'join_requests',
  'members',
  'groups',
  'auth_tokens',
  'users',
]

export function resetDatabase() {
  db.pragma('foreign_keys = OFF')
  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`)
  }
  db.exec('DELETE FROM sqlite_sequence')
  db.pragma('foreign_keys = ON')
}
