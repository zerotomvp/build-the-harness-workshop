import { beforeEach, describe, expect, it } from 'vitest'
import { addMember, balanceOf, call, createGroup, createSession, createUser, resetDatabase, setPrice } from './helpers'

describe('sessions', () => {
  beforeEach(() => {
    resetDatabase()
  })

  it('lets an admin create a session', async () => {
    const alice = createUser('Alice')
    const group = createGroup('Runners')
    const adminId = addMember(group.id, alice.id, 'admin')

    const { status, data } = await call('POST', '/sessions', alice.token, {
      body: { groupId: group.id, title: 'Long run', location: 'Boathouse', startsAt: '2030-05-01T08:00:00Z' },
      memberId: adminId,
    })
    expect(status).toBe(201)
    expect(data.session.title).toBe('Long run')
  })

  it('lists upcoming sessions for a group', async () => {
    const alice = createUser('Alice')
    const group = createGroup('Runners')
    addMember(group.id, alice.id)
    createSession(group.id, 'Long run', 2)
    createSession(group.id, 'Last week', -7)

    const { data } = await call('GET', `/sessions?groupId=${group.id}`, alice.token)
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].title).toBe('Long run')
  })

  it('RSVPs to a session', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    addMember(group.id, bob.id)
    const sessionId = createSession(group.id, 'Intervals')

    const { status, data } = await call('POST', `/sessions/${sessionId}/rsvp`, bob.token)
    expect(status).toBe(201)
    expect(data.rsvp.status).toBe('going')

    const attendees = await call('GET', `/sessions/${sessionId}/attendees`, bob.token)
    expect(attendees.data.total).toBe(1)
    expect(attendees.data.attendees[0].name).toBe('Bob')
  })

  it('charges the session price on RSVP', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    const bobId = addMember(group.id, bob.id)
    setPrice(group.id, 'session', 500)
    const sessionId = createSession(group.id, 'Intervals')

    const { data } = await call('POST', `/sessions/${sessionId}/rsvp`, bob.token)
    expect(data.charged).toBe(500)
    expect(balanceOf(bobId)).toBe(500)
  })

  it('refunds the session price when the RSVP is cancelled', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    const bobId = addMember(group.id, bob.id)
    setPrice(group.id, 'session', 500)
    const sessionId = createSession(group.id, 'Intervals')

    await call('POST', `/sessions/${sessionId}/rsvp`, bob.token)
    const { data } = await call('DELETE', `/sessions/${sessionId}/rsvp`, bob.token)
    expect(data.refunded).toBe(500)
    expect(balanceOf(bobId)).toBe(0)
  })

  it('rejects RSVPs when the session is full', async () => {
    const alice = createUser('Alice')
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    const adminId = addMember(group.id, alice.id, 'admin')
    addMember(group.id, bob.id)

    const created = await call('POST', '/sessions', alice.token, {
      body: { groupId: group.id, title: 'Track', startsAt: '2030-05-01T08:00:00Z', capacity: 1 },
      memberId: adminId,
    })
    const sessionId = created.data.session.id

    await call('POST', `/sessions/${sessionId}/rsvp`, alice.token)
    const { status } = await call('POST', `/sessions/${sessionId}/rsvp`, bob.token)
    expect(status).toBe(409)
  })
})
