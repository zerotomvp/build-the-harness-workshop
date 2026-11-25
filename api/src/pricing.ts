import { db } from './db'

export type PriceKind = 'session' | 'monthly' | 'joining'

export const PRICE_KINDS: PriceKind[] = ['session', 'monthly', 'joining']

export const DEFAULT_LABELS: Record<PriceKind, string> = {
  session: 'Drop-in session',
  monthly: 'Monthly dues',
  joining: 'Joining fee',
}

export function isPriceKind(kind: string): kind is PriceKind {
  return (PRICE_KINDS as string[]).includes(kind)
}

export function priceFor(groupId: number, kind: PriceKind): number {
  const row = db
    .prepare('SELECT amount FROM prices WHERE group_id = ? AND kind = ?')
    .get(groupId, kind) as { amount: number } | undefined
  if (!row) return 0
  return row.amount
}
