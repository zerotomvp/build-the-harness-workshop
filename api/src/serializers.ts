import type {
  Group,
  JoinRequest,
  Member,
  MemberWithUser,
  Message,
  Price,
  Room,
  Rsvp,
  Session,
  Transaction,
  User,
} from './types'

export function toUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatar_color,
  }
}

export function toGroup(group: Group) {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    description: group.description,
    visibility: group.visibility,
    createdAt: group.created_at,
  }
}

export function toMember(member: Member) {
  return {
    id: member.id,
    groupId: member.group_id,
    userId: member.user_id,
    role: member.role,
    balance: member.balance,
    joinedAt: member.joined_at,
  }
}

export function toMemberWithUser(member: MemberWithUser) {
  return {
    ...toMember(member),
    name: member.name,
    email: member.email,
    avatarColor: member.avatar_color,
  }
}

export function toJoinRequest(
  request: JoinRequest & { name: string; email: string }
) {
  return {
    id: request.id,
    groupId: request.group_id,
    userId: request.user_id,
    name: request.name,
    email: request.email,
    message: request.message,
    status: request.status,
    createdAt: request.created_at,
  }
}

export function toSession(session: Session) {
  return {
    id: session.id,
    groupId: session.group_id,
    title: session.title,
    location: session.location,
    startsAt: session.starts_at,
    capacity: session.capacity,
  }
}

export function toRsvp(rsvp: Rsvp) {
  return {
    id: rsvp.id,
    sessionId: rsvp.session_id,
    userId: rsvp.user_id,
    status: rsvp.status,
  }
}

export function toPrice(price: Price) {
  return {
    kind: price.kind,
    label: price.label,
    amount: price.amount,
    updatedAt: price.updated_at,
  }
}

export function toTransaction(tx: Transaction) {
  return {
    id: tx.id,
    groupId: tx.group_id,
    memberId: tx.member_id,
    kind: tx.kind,
    amount: tx.amount,
    note: tx.note,
    createdAt: tx.created_at,
  }
}

export function toRoom(room: Room) {
  return {
    id: room.id,
    groupId: room.group_id,
    name: room.name,
  }
}

export function toMessage(message: Message) {
  return {
    id: message.id,
    roomId: message.room_id,
    userId: message.user_id,
    userName: message.user_name ?? '',
    body: message.body,
    createdAt: message.created_at,
  }
}
