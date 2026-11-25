import { serve } from '@hono/node-server'
import { app } from './app'
import { db } from './db'
import { seed } from './seed'

const existing = db.prepare('SELECT id FROM users LIMIT 1').get()
if (!existing) {
  seed()
  console.log('Seeded empty database')
}

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Hive API listening on http://localhost:${info.port}`)
})
