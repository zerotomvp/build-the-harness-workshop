import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

const demoAccounts = ['alice@hive.test', 'bob@hive.test', 'carla@hive.test', 'dev@hive.test', 'erin@hive.test']

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="centered">
      <form className="card login" onSubmit={submit}>
        <h1>Hive</h1>
        <p className="muted">Sign in with your email address.</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <button type="submit">Sign in</button>
        {error && <p className="error">{error}</p>}
        <div className="demo">
          {demoAccounts.map((account) => (
            <button type="button" key={account} className="link" onClick={() => setEmail(account)}>
              {account}
            </button>
          ))}
        </div>
      </form>
    </div>
  )
}
