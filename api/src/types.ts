export type Role = 'member' | 'admin' | 'treasurer'
export type Visibility = 'open' | 'invite'

export interface User {
  id: number
  name: string
  email: string
  avatar_color: string
  created_at: string
}

export interface Group {
  id: number
  name: string
  slug: string
  description: string
  visibility: Visibility
  created_by: number | null
  created_at: string
}

export interface Member {
  id: number
  group_id: number
  user_id: number
  role: Role
  balance: number
  joined_at: string
}

export interface MemberWithUser extends Member {
  name: string
  email: string
  avatar_color: string
}

export interface JoinRequest {
  id: number
  group_id: number
  user_id: number
  message: string
  status: 'pending' | 'approved' | 'declined'
  created_at: string
}

export interface Session {
  id: number
  group_id: number
  title: string
  location: string
  starts_at: string
  capacity: number | null
  created_by: number | null
  created_at: string
}

export interface Rsvp {
  id: number
  session_id: number
  user_id: number
  status: 'going' | 'cancelled'
  created_at: string
}

export interface Price {
  id: number
  group_id: number
  kind: string
  label: string
  amount: number
  updated_by: number | null
  updated_at: string
}

export interface Transaction {
  id: number
  group_id: number
  member_id: number
  kind: 'charge' | 'payment' | 'refund' | 'adjustment'
  amount: number
  note: string
  created_by: number | null
  created_at: string
}

export interface Room {
  id: number
  group_id: number
  name: string
  created_at: string
}

export interface Message {
  id: number
  room_id: number
  user_id: number
  body: string
  created_at: string
  user_name?: string
}

export type AppEnv = {
  Variables: {
    user: User
  }
}
