import { createMiddleware } from 'hono/factory'
import { db } from './db'
import type { AppEnv, User } from './types'

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const user = db
    .prepare(
      'SELECT u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?'
    )
    .get(token) as User | undefined
  if (!user) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  c.set('user', user)
  await next()
})
