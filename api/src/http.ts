import type { Context } from 'hono'

export async function readBody<T>(c: Context): Promise<Partial<T>> {
  try {
    return (await c.req.json()) as Partial<T>
  } catch {
    return {}
  }
}

export function parseId(value: string | undefined): number {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

export function parseAmount(value: unknown): number | null {
  const amount = typeof value === 'string' ? Number(value) : value
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null
  return Math.round(amount)
}
