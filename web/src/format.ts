const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })

export function formatMoney(cents: number) {
  return money.format(cents / 100)
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toCents(value: string) {
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN
}
