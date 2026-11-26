export type Role = 'member' | 'admin' | 'treasurer'
export type Visibility = 'open' | 'invite'
export type PriceKind = 'session' | 'monthly' | 'joining'

export interface User {
  id: number
  name: string
  email: string
  avatarColor: string
}

export interface Membership {
  memberId: number
  groupId: number
  groupName: string
  role: Role
  balance: number
}

export interface Me {
  user: User
  memberships: Membership[]
}

export interface Group {
  id: number
  name: string
  slug: string
  description: string
  visibility: Visibility
  createdAt: string
  memberCount: number
  isMember?: boolean
}

export interface GroupDetail extends Group {
  membership: Member | null
  hasPendingRequest: boolean
}

export interface Member {
  id: number
  groupId: number
  userId: number
  role: Role
  balance: number
  joinedAt: string
  name?: string
  email?: string
  avatarColor?: string
}

export interface JoinRequest {
  id: number
  groupId: number
  userId: number
  name: string
  email: string
  message: string
  createdAt: string
}

export interface Session {
  id: number
  groupId: number
  groupName?: string
  title: string
  location: string
  startsAt: string
  capacity: number | null
  goingCount: number
  isGoing: boolean
}

export interface Attendee {
  userId: number
  name: string
  avatarColor: string
  status: 'going' | 'cancelled'
}

export interface Price {
  kind: PriceKind
  label: string
  amount: number
  updatedAt: string
}

export interface Fee {
  id: number
  groupId: number
  memberId: number
  kind: 'charge' | 'payment' | 'refund' | 'adjustment'
  amount: number
  note: string
  createdAt: string
}

export interface Balance {
  memberId: number
  userId: number
  name: string
  email: string
  role: Role
  balance: number
  display: string
}

export interface Message {
  id: number
  roomId: number
  userId: number
  userName: string
  body: string
  createdAt: string
}

export interface Room {
  id: number
  groupId: number
  name: string
  lastMessage: Message | null
}
