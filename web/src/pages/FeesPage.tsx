import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatMoney } from '../format'
import type { Fee } from '../types'

const kindLabels: Record<Fee['kind'], string> = {
  charge: 'Charge',
  payment: 'Payment',
  refund: 'Refund',
  adjustment: 'Adjustment',
}

export default function FeesPage() {
  const { me, refresh } = useAuth()
  const [history, setHistory] = useState<Record<number, Fee[]>>({})

  const memberships = me?.memberships ?? []

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    for (const m of memberships) {
      api.transactions(m.groupId).then((res) => setHistory((h) => ({ ...h, [m.groupId]: res.transactions })))
    }
  }, [memberships.length])

  return (
    <section>
      <h2>My fees</h2>
      {memberships.length === 0 && <p className="muted">You haven't joined any groups yet.</p>}
      {memberships.map((m) => (
        <div key={m.memberId} className="card fees">
          <div className="section-header">
            <h3>{m.groupName}</h3>
            <span className={m.balance > 0 ? 'owed' : 'settled'}>
              {m.balance > 0 ? `You owe ${formatMoney(m.balance)}` : 'All settled'}
            </span>
          </div>
          <table>
            <tbody>
              {(history[m.groupId] ?? []).map((fee) => (
                <tr key={fee.id}>
                  <td>{new Date(fee.createdAt).toLocaleDateString('en-IE')}</td>
                  <td>{kindLabels[fee.kind]}</td>
                  <td>{fee.note}</td>
                  <td className="amount">{formatMoney(fee.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}
