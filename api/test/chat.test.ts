import { beforeEach, describe, expect, it } from 'vitest'
import {
  addMember,
  call,
  createGroup,
  createUser,
  db,
  resetDatabase,
} from './helpers'

function roomFor(groupId: number) {
  return (
    db.prepare('SELECT id FROM rooms WHERE group_id = ?').get(groupId) as {
      id: number
    }
  ).id
}

describe('chat', () => {
  beforeEach(() => {
    resetDatabase()
  })

  it('lists the room for a group with its last message', async () => {
    const alice = createUser('Alice')
    const group = createGroup('Runners')
    addMember(group.id, alice.id)
    await call('POST', `/rooms/${roomFor(group.id)}/messages`, alice.token, {
      body: { body: 'Hello runners' },
    })

    const { status, data } = await call(
      'GET',
      `/rooms?groupId=${group.id}`,
      alice.token
    )
    expect(status).toBe(200)
    expect(data.rooms).toHaveLength(1)
    expect(data.rooms[0].lastMessage.body).toBe('Hello runners')
  })

  it('posts and lists messages', async () => {
    const alice = createUser('Alice')
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    addMember(group.id, alice.id)
    addMember(group.id, bob.id)
    const roomId = roomFor(group.id)

    const posted = await call(
      'POST',
      `/rooms/${roomId}/messages`,
      alice.token,
      { body: { body: 'Run at 8?' } }
    )
    expect(posted.status).toBe(201)
    await call('POST', `/rooms/${roomId}/messages`, bob.token, {
      body: { body: 'See you there' },
    })

    const { data } = await call('GET', `/rooms/${roomId}/messages`, alice.token)
    expect(data.messages.map((m: { body: string }) => m.body)).toEqual([
      'Run at 8?',
      'See you there',
    ])
    expect(data.messages[1].userName).toBe('Bob')
  })

  it('rejects empty messages', async () => {
    const alice = createUser('Alice')
    const group = createGroup('Runners')
    addMember(group.id, alice.id)

    const { status } = await call(
      'POST',
      `/rooms/${roomFor(group.id)}/messages`,
      alice.token,
      { body: { body: '  ' } }
    )
    expect(status).toBe(400)
  })
})
