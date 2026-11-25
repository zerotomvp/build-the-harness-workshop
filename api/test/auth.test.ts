import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { addMember, call, createGroup, createUser, resetDatabase } from './helpers'

describe('auth', () => {
  beforeEach(() => {
    resetDatabase()
  })

  it('logs in with a known email', async () => {
    createUser('Alice')
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { token: string; user: { name: string } }
    expect(data.token).toBeTruthy()
    expect(data.user.name).toBe('Alice')
  })

  it('rejects requests without a token', async () => {
    const res = await app.request('/groups')
    expect(res.status).toBe(401)
  })

  it('returns the current user with memberships', async () => {
    const alice = createUser('Alice')
    const group = createGroup('Runners')
    addMember(group.id, alice.id, 'admin')

    const { status, data } = await call('GET', '/me', alice.token)
    expect(status).toBe(200)
    expect(data.user.email).toBe('alice@example.com')
    expect(data.memberships).toHaveLength(1)
    expect(data.memberships[0].role).toBe('admin')
  })
})
