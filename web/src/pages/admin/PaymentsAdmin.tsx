import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { formatMoney, toCents } from '../../format'
import type { Balance } from '../../types'
import { useAdmin } from './AdminLayout'

export default function PaymentsAdmin() {
  const { groupId, membership } = useAdmin()
  const [balances, setBalances] = useState<Balance[]>([])
  const [total, setTotal] = useState(0)
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const res = await api.balances(groupId, membership.memberId)
    setBalances(res.balances)
    setTotal(res.totalOutstanding)
  }, [groupId, membership.memberId])

  useEffect(() => {
    load()
  }, [load])

  const record = async (row: Balance) => {
    const amount = toCents(amounts[row.memberId] ?? '')
    if (!amount || Number.isNaN(amount)) return
    await api.recordPayment(
      groupId,
      row.memberId,
      { amount, note: 'Payment received' },
      membership.memberId
    )
    setAmounts({ ...amounts, [row.memberId]: '' })
    setNotice(`Recorded ${formatMoney(amount)} from ${row.name}.`)
    await load()
  }

  const runDues = async () => {
    if (!confirm('Charge monthly dues to every member?')) return
    const res = await api.runDues(groupId, membership.memberId)
    setNotice(
      res.charged
        ? `Charged ${res.charged} members.`
        : 'No members were charged.'
    )
    await load()
  }

  return (
    <div>
      <div className="section-header">
        <p>
          Outstanding: <strong>{formatMoney(total)}</strong>
        </p>
        <button onClick={runDues}>Run monthly dues</button>
      </div>
      {notice && <p className="notice">{notice}</p>}
      <table className="card">
        <thead>
          <tr>
            <th>Member</th>
            <th>Balance</th>
            <th>Record payment</th>
          </tr>
        </thead>
        <tbody>
          {balances.map(row => (
            <tr key={row.memberId}>
              <td>
                {row.name}
                <div className="muted">{row.email}</div>
              </td>
              <td className={row.balance > 0 ? 'owed' : ''}>{row.display}</td>
              <td className="actions">
                <input
                  className="money"
                  placeholder="0.00"
                  value={amounts[row.memberId] ?? ''}
                  onChange={e =>
                    setAmounts({ ...amounts, [row.memberId]: e.target.value })
                  }
                />
                <button onClick={() => record(row)}>Record</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
