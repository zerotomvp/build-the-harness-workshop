import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import type { JoinRequest, Member, Role } from '../../types'
import { useAdmin } from './AdminLayout'

const roles: Role[] = ['member', 'admin', 'treasurer']

export default function MembersAdmin() {
  const { groupId, membership } = useAdmin()
  const isAdmin = membership.role === 'admin'
  const [members, setMembers] = useState<Member[]>([])
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await api.members(groupId)
    setMembers(res.members)
    if (isAdmin) {
      const pending = await api.requests(groupId, membership.memberId)
      setRequests(pending.requests)
    }
  }, [groupId, isAdmin, membership.memberId])

  useEffect(() => {
    load()
  }, [load])

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${groupId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const approve = async (request: JoinRequest) => {
    await api.approveRequest(groupId, request.id, membership.memberId)
    await load()
  }

  const decline = async (request: JoinRequest) => {
    await api.declineRequest(groupId, request.id, membership.memberId)
    await load()
  }

  const changeRole = async (member: Member, role: Role) => {
    await api.setRole(groupId, member.id, role, membership.memberId)
    await load()
  }

  const remove = async (member: Member) => {
    if (!confirm(`Remove ${member.name} from the group?`)) return
    await api.removeMember(groupId, member.id, membership.memberId)
    await load()
  }

  return (
    <div>
      {isAdmin && (
        <div className="card">
          <div className="section-header">
            <h3>Join requests</h3>
            <button className="secondary" onClick={copyInvite}>
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
          </div>
          {requests.length === 0 && <p className="muted">No pending requests.</p>}
          <ul className="list">
            {requests.map((request) => (
              <li key={request.id} className="row">
                <div>
                  <strong>{request.name}</strong> <span className="muted">{request.email}</span>
                  {request.message && <p className="muted">“{request.message}”</p>}
                </div>
                <div className="actions">
                  <button onClick={() => approve(request)}>Approve</button>
                  <button className="secondary" onClick={() => decline(request)}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <table className="card">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td className="muted">{member.email}</td>
              <td>
                {isAdmin ? (
                  <select value={member.role} onChange={(e) => changeRole(member, e.target.value as Role)}>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                ) : (
                  member.role
                )}
              </td>
              <td className="muted">{new Date(member.joinedAt).toLocaleDateString('en-IE')}</td>
              {isAdmin && (
                <td>
                  {member.id !== membership.memberId && (
                    <button className="link danger" onClick={() => remove(member)}>
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
