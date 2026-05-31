import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  ADMIN_THEMES,
  getAdminTheme,
  readStoredAdminThemeId,
  storeAdminThemeId,
} from './adminThemes.mjs'

/** @type {import('react').Context<{
 *   theme: import('./adminThemes.mjs').AdminTheme
 *   themeId: string
 *   setThemeId: (id: string) => void
 *   themes: typeof ADMIN_THEMES
 * } | null>} */
const AdminThemeContext = createContext(null)

export function AdminThemeProvider() {
  const [themeId, setThemeIdState] = useState(() => readStoredAdminThemeId())

  const setThemeId = useCallback((id) => {
    const next = getAdminTheme(id)
    setThemeIdState(next.id)
    storeAdminThemeId(next.id)
  }, [])

  const value = useMemo(
    () => ({
      theme: getAdminTheme(themeId),
      themeId,
      setThemeId,
      themes: ADMIN_THEMES,
    }),
    [themeId, setThemeId],
  )

  return (
    <AdminThemeContext.Provider value={value}>
      <Outlet />
    </AdminThemeContext.Provider>
  )
}

export function useAdminTheme() {
  const ctx = useContext(AdminThemeContext)
  if (!ctx) throw new Error('useAdminTheme must be used within AdminThemeProvider')
  return ctx
}

/** Safe when rendered outside admin routes (e.g. dev email preview). */
export function useAdminThemeOptional() {
  return useContext(AdminThemeContext)
}
