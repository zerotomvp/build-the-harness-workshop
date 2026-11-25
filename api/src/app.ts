import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { requireAuth } from './auth'
import authRoutes from './routes/auth'
import chatRoutes from './routes/chat'
import devRoutes from './routes/dev'
import feeRoutes from './routes/fees'
import groupRoutes from './routes/groups'
import sessionRoutes from './routes/sessions'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

const publicPaths = ['/health', '/auth/login', '/dev/seed']

if (process.env.NODE_ENV !== 'test') {
  app.use(logger())
}
app.use(cors())
app.use('*', async (c, next) => {
  if (publicPaths.includes(c.req.path)) return next()
  return requireAuth(c, next)
})

app.get('/health', (c) => c.json({ ok: true }))

app.route('/', authRoutes)
app.route('/', devRoutes)
app.route('/', groupRoutes)
app.route('/', sessionRoutes)
app.route('/', feeRoutes)
app.route('/', chatRoutes)

app.notFound((c) => c.json({ error: 'not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal server error' }, 500)
})
