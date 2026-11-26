import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { GroupDetail } from '../types'

export default function InvitePage() {
  const groupId = Number(useParams().groupId)
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .group(groupId)
      .then(res => setGroup(res.group))
      .catch(err => setError(err.message))
  }, [groupId])

  const accept = async () => {
    await api.joinGroup(groupId, { isAccepted: true })
    await refresh()
    navigate(`/groups/${groupId}`)
  }

  if (error) return <p className="error">{error}</p>
  if (!group) return <p>Loading…</p>

  return (
    <div className="card invite">
      <h2>You're invited to {group.name}</h2>
      <p className="muted">{group.description}</p>
      {group.membership ? (
        <p>You're already a member.</p>
      ) : (
        <div className="actions">
          <button onClick={accept}>Accept invite</button>
          <button className="secondary" onClick={() => navigate('/')}>
            Not now
          </button>
        </div>
      )}
    </div>
  )
}
