import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Group } from '../types'

export default function GroupsPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    visibility: 'open',
  })

  const load = () => api.groups().then(res => setGroups(res.groups))

  useEffect(() => {
    load()
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const { group } = await api.createGroup(form)
    await refresh()
    navigate(`/groups/${group.id}`)
  }

  return (
    <section>
      <div className="section-header">
        <h2>Groups</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New group'}
        </button>
      </div>

      {showForm && (
        <form className="card form" onSubmit={create}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            placeholder="What is this group about?"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
          <select
            value={form.visibility}
            onChange={e => setForm({ ...form, visibility: e.target.value })}
          >
            <option value="open">Open: anyone can join</option>
            <option value="invite">Invite only</option>
          </select>
          <button type="submit">Create group</button>
        </form>
      )}

      <div className="grid">
        {groups.map(group => (
          <Link
            key={group.id}
            to={`/groups/${group.id}`}
            className="card group-card"
          >
            <h3>{group.name}</h3>
            <p className="muted">{group.description}</p>
            <div className="meta">
              <span>{group.memberCount} members</span>
              <span className={`badge ${group.visibility}`}>
                {group.visibility === 'invite' ? 'Invite only' : 'Open'}
              </span>
              {group.isMember && <span className="badge member">Joined</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
