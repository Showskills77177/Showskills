import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'

const UserAuthContext = createContext({
  user: null,
  status: 'loading',
  refresh: async () => {},
  logout: async () => {},
  setUser: () => {},
})

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user ?? null)
        setStatus('ok')
        return data.user ?? null
      }
      setUser(null)
      setStatus('guest')
      return null
    } catch {
      setUser(null)
      setStatus('guest')
      return null
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    setUser(null)
    setStatus('guest')
  }, [])

  const value = useMemo(
    () => ({ user, status, refresh, logout, setUser }),
    [user, status, refresh, logout],
  )

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>
}

export function useUserAuth() {
  return useContext(UserAuthContext)
}
