import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../../api'
import { formatDate } from '../../format'
import type { Session } from '../../types'
import { useAdmin } from './AdminLayout'

const emptyForm = { title: '', location: '', startsAt: '', capacity: '' }

export default function SessionsAdmin() {
  const { groupId, membership } = useAdmin()
  const [sessions, setSessions] = useState<Session[]>([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const load = useCallback(() => api.sessions(groupId).then((res) => setSessions(res.sessions)), [groupId])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.createSession(
        {
          groupId,
          title: form.title,
          location: form.location,
          startsAt: new Date(form.startsAt).toISOString(),
          capacity: form.capacity ? Number(form.capacity) : undefined,
        },
        membership.memberId,
      )
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (session: Session) => {
    if (!confirm(`Delete ${session.title}?`)) return
    await api.deleteSession(session.id, membership.memberId)
    await load()
  }

  return (
    <div>
      <form className="card form inline" onSubmit={create}>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <input
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
        />
        <input
          type="number"
          placeholder="Capacity"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
        />
        <button type="submit">Add session</button>
        {error && <p className="error">{error}</p>}
      </form>

      <table className="card">
        <thead>
          <tr>
            <th>Session</th>
            <th>When</th>
            <th>Going</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                {session.title}
                <div className="muted">{session.location}</div>
              </td>
              <td>{formatDate(session.startsAt)}</td>
              <td>
                {session.goingCount}
                {session.capacity ? ` / ${session.capacity}` : ''}
              </td>
              <td>
                <button className="link danger" onClick={() => remove(session)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
