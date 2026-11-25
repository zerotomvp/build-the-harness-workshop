import type {
  Attendee,
  Balance,
  Fee,
  Group,
  GroupDetail,
  JoinRequest,
  Me,
  Member,
  Message,
  Price,
  PriceKind,
  Role,
  Room,
  Session,
  User,
} from './types'

const TOKEN_KEY = 'hive.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown, memberId?: number): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (memberId) headers['X-Member-Id'] = String(memberId)
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error ?? res.statusText, res.status)
  }
  return data as T
}

export const api = {
  login: (email: string) => request<{ token: string; user: User }>('POST', '/auth/login', { email }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  me: () => request<Me>('GET', '/me'),

  groups: () => request<{ groups: Group[]; total: number }>('GET', '/groups'),
  group: (id: number) => request<{ group: GroupDetail }>('GET', `/groups/${id}`),
  createGroup: (data: { name: string; description: string; visibility: string }) =>
    request<{ group: Group }>('POST', '/groups', data),
  joinGroup: (id: number, data: { isAccepted?: boolean; message?: string } = {}) =>
    request<{ status: 'member' | 'pending'; member?: Member }>('POST', `/groups/${id}/join`, data),
  leaveGroup: (id: number) => request<{ ok: true }>('POST', `/groups/${id}/leave`),
  members: (groupId: number, role?: Role) =>
    request<{ members: Member[]; total: number }>('GET', `/groups/${groupId}/members${role ? `?role=${role}` : ''}`),
  requests: (groupId: number, memberId: number) =>
    request<{ requests: JoinRequest[] }>('GET', `/groups/${groupId}/requests`, undefined, memberId),
  approveRequest: (groupId: number, requestId: number, memberId: number) =>
    request('POST', `/groups/${groupId}/requests/${requestId}/approve`, undefined, memberId),
  declineRequest: (groupId: number, requestId: number, memberId: number) =>
    request('POST', `/groups/${groupId}/requests/${requestId}/decline`, undefined, memberId),
  setRole: (groupId: number, targetId: number, role: Role, memberId: number) =>
    request<{ member: Member }>('PATCH', `/groups/${groupId}/members/${targetId}`, { role }, memberId),
  removeMember: (groupId: number, targetId: number, memberId: number) =>
    request('DELETE', `/groups/${groupId}/members/${targetId}`, undefined, memberId),

  sessions: (groupId?: number) =>
    request<{ sessions: Session[]; total: number }>('GET', `/sessions${groupId ? `?groupId=${groupId}` : ''}`),
  createSession: (
    data: { groupId: number; title: string; location: string; startsAt: string; capacity?: number },
    memberId: number,
  ) => request<{ session: Session }>('POST', '/sessions', data, memberId),
  deleteSession: (id: number, memberId: number) => request('DELETE', `/sessions/${id}`, undefined, memberId),
  attendees: (sessionId: number) =>
    request<{ attendees: Attendee[]; total: number }>('GET', `/sessions/${sessionId}/attendees`),
  rsvp: (sessionId: number) => request<{ charged: number }>('POST', `/sessions/${sessionId}/rsvp`),
  cancelRsvp: (sessionId: number) => request<{ refunded: number }>('DELETE', `/sessions/${sessionId}/rsvp`),

  prices: (groupId: number) => request<{ prices: Price[] }>('GET', `/groups/${groupId}/prices`),
  setPrice: (groupId: number, kind: PriceKind, data: { label: string; amount: number }, memberId: number) =>
    request<{ price: Price }>('PUT', `/groups/${groupId}/prices/${kind}`, data, memberId),
  deletePrice: (groupId: number, kind: PriceKind, memberId: number) =>
    request('DELETE', `/groups/${groupId}/prices/${kind}`, undefined, memberId),
  balances: (groupId: number, memberId: number) =>
    request<{ balances: Balance[]; totalOutstanding: number }>('GET', `/groups/${groupId}/balances`, undefined, memberId),
  recordPayment: (groupId: number, targetId: number, data: { amount: number; note: string }, memberId: number) =>
    request<{ balance: number }>('POST', `/groups/${groupId}/members/${targetId}/payments`, data, memberId),
  addCharge: (groupId: number, targetId: number, data: { amount: number; note: string }, memberId: number) =>
    request<{ balance: number }>('POST', `/groups/${groupId}/members/${targetId}/charges`, data, memberId),
  runDues: (groupId: number, memberId: number) =>
    request<{ charged: number; amount?: number }>('POST', `/groups/${groupId}/dues`, {}, memberId),
  transactions: (groupId: number) =>
    request<{ transactions: Fee[]; total: number }>('GET', `/transactions?groupId=${groupId}`),

  rooms: (groupId?: number) => request<{ rooms: Room[] }>('GET', `/rooms${groupId ? `?groupId=${groupId}` : ''}`),
  messages: (roomId: number, after = 0) =>
    request<{ messages: Message[] }>('GET', `/rooms/${roomId}/messages${after ? `?after=${after}` : ''}`),
  postMessage: (roomId: number, body: string) =>
    request<{ message: Message }>('POST', `/rooms/${roomId}/messages`, { body }),
}
