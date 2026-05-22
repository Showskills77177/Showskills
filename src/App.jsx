import { Analytics } from '@vercel/analytics/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EntryFlowProvider } from './entry/EntryFlowProvider'
import { AdminLayout } from './admin/AdminLayout'
import { RequireAdmin } from './admin/RequireAdmin'
import { Layout } from './components/Layout'
import HomePage from './pages/HomePage'
import CompetitionsPage from './pages/CompetitionsPage'
import KickupsArchivePage from './pages/KickupsArchivePage'
import AdminLoginPage from './pages/admin/LoginPage'
import AdminDashboardPage from './pages/admin/DashboardPage'
import AdminUsersPage from './pages/admin/UsersPage'
import AdminTicketsPage from './pages/admin/TicketsPage'
import AdminPaymentsPage from './pages/admin/PaymentsPage'
import AdminSubmissionsPage from './pages/admin/SubmissionsPage'
import AdminTestEmailPage from './pages/admin/TestEmailPage'
import AdminDrawWinnerPage from './pages/admin/DrawWinnerPage'
import AdminEntryAttemptsPage from './pages/admin/EntryAttemptsPage'
import ContactPage from './pages/ContactPage'
import { PurchaseEmailPreview } from './components/admin/PurchaseEmailPreview'

const rawBase = import.meta.env.BASE_URL
const routerBasename =
  rawBase && rawBase !== '/' ? rawBase.replace(/\/$/, '') || undefined : undefined

export default function App() {
  return (
    <>
      <Analytics />
      <BrowserRouter basename={routerBasename}>
      <EntryFlowProvider>
        <Routes>
          {import.meta.env.DEV ? (
            <Route
              path="/dev/email-preview"
              element={
                <div className="min-h-svh bg-[#071512] px-4 py-8 text-stone-300 sm:px-8">
                  <div className="mx-auto max-w-6xl">
                    <p className="mb-6 text-sm text-amber-200/90">
                      Local dev only — same previews as{' '}
                      <span className="font-mono text-stone-400">/admin/test-email</span> (no login).
                    </p>
                    <PurchaseEmailPreview />
                  </div>
                </div>
              }
            />
          ) : null}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="tickets" element={<AdminTicketsPage />} />
              <Route path="draw" element={<AdminDrawWinnerPage />} />
              <Route path="entry-attempts" element={<AdminEntryAttemptsPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="submissions" element={<AdminSubmissionsPage />} />
              <Route path="test-email" element={<AdminTestEmailPage />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>
          </Route>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="competitions" element={<CompetitionsPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="archive/ronaldo-shirt-giveaway" element={<KickupsArchivePage />} />
            <Route path="archive/35-kickups" element={<Navigate to="/archive/ronaldo-shirt-giveaway" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </EntryFlowProvider>
    </BrowserRouter>
    </>
  )
}
