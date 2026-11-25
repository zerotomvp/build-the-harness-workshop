import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatDate, formatMoney } from '../format'
import type { GroupDetail, Member, Price, Session } from '../types'

export default function GroupPage() {
  const groupId = Number(useParams().groupId)
  const { refresh } = useAuth()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [prices, setPrices] = useState<Price[]>([])
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [g, s, m, p] = await Promise.all([
      api.group(groupId),
      api.sessions(groupId),
      api.members(groupId),
      api.prices(groupId),
    ])
    setGroup(g.group)
    setSessions(s.sessions)
    setMembers(m.members)
    setPrices(p.prices)
  }, [groupId])

  useEffect(() => {
    load()
  }, [load])

  if (!group) return <p>Loading…</p>

  const membership = group.membership
  const canManage = membership && (membership.role === 'admin' || membership.role === 'treasurer')
  const sessionPrice = prices.find((p) => p.kind === 'session')

  const join = async () => {
    const res = await api.joinGroup(groupId)
    setNotice(res.status === 'pending' ? 'Request sent. An admin will review it.' : 'Welcome to the group!')
    await Promise.all([load(), refresh()])
  }

  const leave = async () => {
    if (!confirm(`Leave ${group.name}?`)) return
    await api.leaveGroup(groupId)
    await Promise.all([load(), refresh()])
  }

  const toggleRsvp = async (session: Session) => {
    if (session.isGoing) {
      const res = await api.cancelRsvp(session.id)
      setNotice(res.refunded ? `RSVP cancelled, ${formatMoney(res.refunded)} refunded.` : 'RSVP cancelled.')
    } else {
      const res = await api.rsvp(session.id)
      setNotice(res.charged ? `You're going! ${formatMoney(res.charged)} added to your balance.` : "You're going!")
    }
    await Promise.all([load(), refresh()])
  }

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>{group.name}</h2>
          <p className="muted">{group.description}</p>
        </div>
        <div className="actions">
          {canManage && (
            <Link className="button secondary" to={`/groups/${groupId}/admin`}>
              Manage
            </Link>
          )}
          {membership ? (
            <button className="secondary" onClick={leave}>
              Leave
            </button>
          ) : group.hasPendingRequest ? (
            <span className="badge">Request pending</span>
          ) : (
            <button onClick={join}>{group.visibility === 'invite' ? 'Request to join' : 'Join'}</button>
          )}
        </div>
      </div>

      {notice && <p className="notice">{notice}</p>}

      {membership && (
        <p className="muted">
          Your balance: <strong>{formatMoney(membership.balance)}</strong>
          {sessionPrice && <> · Drop-in sessions are {formatMoney(sessionPrice.amount)}</>}
        </p>
      )}

      <div className="columns">
        <div>
          <h3>Upcoming sessions</h3>
          {sessions.length === 0 && <p className="muted">No upcoming sessions.</p>}
          <ul className="list">
            {sessions.map((session) => (
              <li key={session.id} className="card session">
                <div>
                  <strong>{session.title}</strong>
                  <div className="muted">
                    {formatDate(session.startsAt)} · {session.location}
                  </div>
                  <div className="muted">
                    {session.goingCount} going{session.capacity ? ` of ${session.capacity}` : ''}
                  </div>
                </div>
                {membership && (
                  <button className={session.isGoing ? 'secondary' : ''} onClick={() => toggleRsvp(session)}>
                    {session.isGoing ? 'Cancel RSVP' : 'RSVP'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Members ({members.length})</h3>
          <ul className="list compact">
            {members.map((member) => (
              <li key={member.id}>
                <span className="avatar" style={{ background: member.avatarColor }}>
                  {member.name?.[0]}
                </span>
                {member.name}
                {member.role !== 'member' && <span className="badge">{member.role}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
