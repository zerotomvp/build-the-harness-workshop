import { beforeEach, describe, expect, it } from 'vitest'
import { addMember, balanceOf, call, createGroup, createUser, resetDatabase, setPrice } from './helpers'

describe('fees', () => {
  beforeEach(() => {
    resetDatabase()
  })

  it('lets the treasurer set a price', async () => {
    const bob = createUser('Bob')
    const group = createGroup('Runners')
    const treasurerId = addMember(group.id, bob.id, 'treasurer')

    const { status, data } = await call('PUT', `/groups/${group.id}/prices/monthly`, bob.token, {
      body: { amount: 2500 },
      memberId: treasurerId,
    })
    expect(status).toBe(200)
    expect(data.price.amount).toBe(2500)
    expect(data.price.label).toBe('Monthly dues')

    const prices = await call('GET', `/groups/${group.id}/prices`, bob.token)
    expect(prices.data.prices).toHaveLength(1)
  })

  it('does not let a regular member set prices', async () => {
    const carla = createUser('Carla')
    const group = createGroup('Runners')
    const memberId = addMember(group.id, carla.id)

    const { status } = await call('PUT', `/groups/${group.id}/prices/monthly`, carla.token, {
      body: { amount: 100 },
      memberId,
    })
    expect(status).toBe(403)
  })

  it('records a charge and a payment', async () => {
    const bob = createUser('Bob')
    const carla = createUser('Carla')
    const group = createGroup('Runners')
    const treasurerId = addMember(group.id, bob.id, 'treasurer')
    const carlaId = addMember(group.id, carla.id)

    const charge = await call('POST', `/groups/${group.id}/members/${carlaId}/charges`, bob.token, {
      body: { amount: 3000, note: 'Club kit' },
      memberId: treasurerId,
    })
    expect(charge.status).toBe(201)
    expect(charge.data.balance).toBe(3000)

    const payment = await call('POST', `/groups/${group.id}/members/${carlaId}/payments`, bob.token, {
      body: { amount: 1000 },
      memberId: treasurerId,
    })
    expect(payment.data.balance).toBe(2000)
    expect(balanceOf(carlaId)).toBe(2000)
  })

  it('shows balances to the treasurer', async () => {
    const bob = createUser('Bob')
    const carla = createUser('Carla')
    const group = createGroup('Runners')
    const treasurerId = addMember(group.id, bob.id, 'treasurer')
    addMember(group.id, carla.id, 'member', 1500)

    const { status, data } = await call('GET', `/groups/${group.id}/balances`, bob.token, { memberId: treasurerId })
    expect(status).toBe(200)
    expect(data.total).toBe(2)
    expect(data.totalOutstanding).toBe(1500)
  })

  it('charges monthly dues to every member', async () => {
    const bob = createUser('Bob')
    const carla = createUser('Carla')
    const group = createGroup('Runners')
    const treasurerId = addMember(group.id, bob.id, 'treasurer')
    const carlaId = addMember(group.id, carla.id)
    setPrice(group.id, 'monthly', 2500)

    const { data } = await call('POST', `/groups/${group.id}/dues`, bob.token, { body: {}, memberId: treasurerId })
    expect(data.charged).toBe(2)
    expect(balanceOf(carlaId)).toBe(2500)
    expect(balanceOf(treasurerId)).toBe(2500)
  })
})
