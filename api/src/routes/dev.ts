import { Hono } from 'hono'
import { seed } from '../seed'
import type { AppEnv } from '../types'

const dev = new Hono<AppEnv>()

dev.post('/dev/seed', c => {
  if (process.env.HIVE_DEV_SEED !== '1') {
    return c.json({ error: 'not found' }, 404)
  }
  const summary = seed()
  return c.json({ ok: true, ...summary })
})

export default dev
