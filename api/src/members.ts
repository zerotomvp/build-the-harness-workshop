import type { Context } from 'hono'
import { db } from './db'
import type { AppEnv, Member, Role } from './types'

export const ROLES: Role[] = ['member', 'admin', 'treasurer']

// The web client sends the membership it is acting as in the X-Member-Id header.
export function actingMember(c: Context<AppEnv>): Member | undefined {
  const id = Number(c.req.header('x-member-id'))
  if (!id) return undefined
  return db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Member | undefined
}

export function hasRole(member: Member | undefined, ...roles: Role[]): member is Member {
  return !!member && roles.includes(member.role)
}
