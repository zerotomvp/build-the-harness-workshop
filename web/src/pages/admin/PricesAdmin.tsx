import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { formatMoney, toCents } from '../../format'
import type { Price, PriceKind } from '../../types'
import { useAdmin } from './AdminLayout'

const kinds: { kind: PriceKind; label: string; help: string }[] = [
  { kind: 'session', label: 'Drop-in session', help: 'Charged when a member RSVPs to a session.' },
  { kind: 'monthly', label: 'Monthly dues', help: 'Charged to every member when you run dues.' },
  { kind: 'joining', label: 'Joining fee', help: 'Charged once when someone joins.' },
]

export default function PricesAdmin() {
  const { groupId, membership } = useAdmin()
  const [prices, setPrices] = useState<Price[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState('')

  const load = useCallback(async () => {
    const res = await api.prices(groupId)
    setPrices(res.prices)
    setDrafts(Object.fromEntries(res.prices.map((p) => [p.kind, (p.amount / 100).toFixed(2)])))
  }, [groupId])

  useEffect(() => {
    load()
  }, [load])

  const save = async (kind: PriceKind, label: string) => {
    const amount = toCents(drafts[kind] ?? '')
    if (Number.isNaN(amount)) return
    const existing = prices.find((p) => p.kind === kind)
    await api.setPrice(groupId, kind, { label: existing?.label ?? label, amount }, membership.memberId)
    setSaved(kind)
    await load()
  }

  const clear = async (kind: PriceKind) => {
    await api.deletePrice(groupId, kind, membership.memberId)
    await load()
  }

  return (
    <div className="card">
      <h3>Prices</h3>
      <table>
        <tbody>
          {kinds.map(({ kind, label, help }) => {
            const current = prices.find((p) => p.kind === kind)
            return (
              <tr key={kind}>
                <td>
                  <strong>{current?.label ?? label}</strong>
                  <div className="muted">{help}</div>
                </td>
                <td>{current ? formatMoney(current.amount) : <span className="muted">Not set</span>}</td>
                <td>
                  <input
                    className="money"
                    value={drafts[kind] ?? ''}
                    placeholder="0.00"
                    onChange={(e) => setDrafts({ ...drafts, [kind]: e.target.value })}
                  />
                </td>
                <td className="actions">
                  <button onClick={() => save(kind, label)}>{saved === kind ? 'Saved' : 'Save'}</button>
                  {current && (
                    <button className="link danger" onClick={() => clear(kind)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
