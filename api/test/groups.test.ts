import { beforeEach, describe, expect, it } from 'vitest'
import { addMember, balanceOf, call, createGroup, createUser, db, resetDatabase, setPrice } from './helpers'

describe('groups', () => {
  beforeEach(() => {
    resetDatabase()
  })

  it('lists groups with member counts', async () => {
    const alice = createUser('Alice')
    const group = createGroup('Runners')
    addMember(group.id, alice.id, 'admin')

    const { status, data } = await call('GET', '/groups', alice.token)
    expect(status).toBe(200)
    expect(data.groups).toHaveLength(1)
    expect(data.groups[0].memberCount).toBe(1)
    expect(data.groups[0].isMember).toBe(true)
  })

  it('creates a group and makes the creator an admin', async () => {
    const alice = createUser('Alice')
    const { status, data } = await call('POST', '/groups', alice.token, {
      body: { name: 'Book Club', visibility: 'invite' },
    })
    expect(status).toBe(201)
    expect(data.group.slug).toBe('book-club')
    expect(data.group.visibility).toBe('invite')

    const me = await call('GET', '/me', alice.token)
    expect(me.data.memberships[0].role).toBe('admin')
  })

  it('joins an open group', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Runners')

    const { status, data } = await call('POST', `/groups/${group.id}/join`, bob.token, { body: {} })
    expect(status).toBe(201)
    expect(data.status).toBe('member')
    expect(data.member.role).toBe('member')
  })

  it('charges the joining fee when one is set', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    setPrice(group.id, 'joining', 1000)

    const { data } = await call('POST', `/groups/${group.id}/join`, bob.token, { body: {} })
    expect(data.member.balance).toBe(1000)
  })

  it('creates a join request for an invite-only group', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Chess', 'invite')

    const { status, data } = await call('POST', `/groups/${group.id}/join`, bob.token, {
      body: { message: 'I play on Thursdays' },
    })
    expect(status).toBe(202)
    expect(data.status).toBe('pending')
  })

  it('joins an invite-only group after accepting an invite', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Chess', 'invite')

    const { status, data } = await call('POST', `/groups/${group.id}/join`, bob.token, {
      body: { isAccepted: true },
    })
    expect(status).toBe(201)
    expect(data.status).toBe('member')
  })

  it('lets an admin approve a join request', async () => {
    const alice = createUser('Alice')
    const bob = createUser('Bob')
    const group = createGroup('Chess', 'invite')
    const adminId = addMember(group.id, alice.id, 'admin')
    setPrice(group.id, 'joining', 500)

    await call('POST', `/groups/${group.id}/join`, bob.token, { body: {} })
    const requests = await call('GET', `/groups/${group.id}/requests`, alice.token, { memberId: adminId })
    expect(requests.data.requests).toHaveLength(1)

    const requestId = requests.data.requests[0].id
    const { status } = await call('POST', `/groups/${group.id}/requests/${requestId}/approve`, alice.token, {
      memberId: adminId,
    })
    expect(status).toBe(200)

    const member = db.prepare('SELECT id FROM members WHERE group_id = ? AND user_id = ?').get(group.id, bob.id) as {
      id: number
    }
    expect(balanceOf(member.id)).toBe(500)
  })

  it('lists members and filters by role', async () => {
    const alice = createUser('Alice')
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    addMember(group.id, alice.id, 'admin')
    addMember(group.id, bob.id, 'treasurer')

    const all = await call('GET', `/groups/${group.id}/members`, alice.token)
    expect(all.data.total).toBe(2)

    const treasurers = await call('GET', `/groups/${group.id}/members?role=treasurer`, alice.token)
    expect(treasurers.data.members).toHaveLength(1)
    expect(treasurers.data.members[0].name).toBe('Bob')
  })

  it('lets an admin change a member role', async () => {
    const alice = createUser('Alice')
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    const adminId = addMember(group.id, alice.id, 'admin')
    const bobId = addMember(group.id, bob.id)

    const { status, data } = await call('PATCH', `/groups/${group.id}/members/${bobId}`, alice.token, {
      body: { role: 'treasurer' },
      memberId: adminId,
    })
    expect(status).toBe(200)
    expect(data.member.role).toBe('treasurer')
  })

  it('does not let a regular member change roles', async () => {
    const alice = createUser('Alice')
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    addMember(group.id, alice.id, 'admin')
    const bobId = addMember(group.id, bob.id)

    const { status } = await call('PATCH', `/groups/${group.id}/members/${bobId}`, bob.token, {
      body: { role: 'admin' },
      memberId: bobId,
    })
    expect(status).toBe(403)
  })
})
