import { db } from './db'
import type { Transaction } from './types'

const formatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatAmount(cents: number): string {
  return formatter.format(cents / 100)
}

export function listEntries(memberId: number): Transaction[] {
  return db
    .prepare(
      'SELECT * FROM transactions WHERE member_id = ? ORDER BY created_at DESC, id DESC LIMIT 1000'
    )
    .all(memberId) as Transaction[]
}
