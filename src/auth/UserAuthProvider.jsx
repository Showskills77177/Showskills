import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'

const UserAuthContext = createContext({
  user: null,
  status: 'loading',
  authModal: null,
  refresh: async () => {},
  logout: async () => {},
  setUser: () => {},
  openAuthModal: () => {},
  closeAuthModal: () => {},
})

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [authModal, setAuthModal] = useState(null)

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
    setAuthModal(null)
  }, [])

  const openAuthModal = useCallback((view = 'login') => {
    if (view === 'profile') {
      setAuthModal(null)
      return
    }
    setAuthModal(view)
  }, [])

  const closeAuthModal = useCallback(() => {
    setAuthModal(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      authModal,
      refresh,
      logout,
      setUser,
      openAuthModal,
      closeAuthModal,
    }),
    [user, status, authModal, refresh, logout, openAuthModal, closeAuthModal],
  )

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>
}

export function useUserAuth() {
  return useContext(UserAuthContext)
}

export function userDisplayName(user) {
  const name = typeof user?.fullName === 'string' ? user.fullName.trim() : ''
  if (!name) return typeof user?.email === 'string' ? user.email.split('@')[0] : ''
  return name.split(/\s+/)[0] || name
}
