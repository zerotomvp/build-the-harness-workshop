import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Message, Room } from '../types'

export default function ChatPage() {
  const { me } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.rooms().then(res => {
      setRooms(res.rooms)
      if (res.rooms.length > 0)
        setActiveId(current => current ?? res.rooms[0].id)
    })
  }, [])

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    const load = () =>
      api.messages(activeId).then(res => {
        if (!cancelled) setMessages(res.messages)
      })
    load()
    const timer = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeId || !draft.trim()) return
    const { message } = await api.postMessage(activeId, draft)
    setMessages(list => [...list, message])
    setDraft('')
  }

  return (
    <section className="chat">
      <aside className="rooms">
        {rooms.map(room => (
          <button
            key={room.id}
            className={`room ${room.id === activeId ? 'active' : ''}`}
            onClick={() => setActiveId(room.id)}
          >
            <strong>{room.name}</strong>
            {room.lastMessage && (
              <span className="muted">
                {room.lastMessage.userName}: {room.lastMessage.body}
              </span>
            )}
          </button>
        ))}
      </aside>
      <div className="thread">
        <div className="messages">
          {messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.userId === me?.user.id ? 'own' : ''}`}
            >
              <span className="author">{message.userName}</span>
              <p>{message.body}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {activeId && (
          <form className="composer" onSubmit={send}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write a message…"
            />
            <button type="submit">Send</button>
          </form>
        )}
      </div>
    </section>
  )
}
