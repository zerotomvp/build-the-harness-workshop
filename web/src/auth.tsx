import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import type { Me, Membership } from './types'

interface AuthState {
  me: Me | null
  loading: boolean
  login: (email: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  membershipFor: (groupId: number) => Membership | undefined
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      setMe(await api.me())
    } catch {
      setToken(null)
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email: string) => {
    const { token } = await api.login(email)
    setToken(token)
    await refresh()
  }

  const logout = async () => {
    await api.logout().catch(() => undefined)
    setToken(null)
    setMe(null)
  }

  const membershipFor = (groupId: number) => me?.memberships.find((m) => m.groupId === groupId)

  return (
    <AuthContext.Provider value={{ me, loading, login, logout, refresh, membershipFor }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
