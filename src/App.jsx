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

const rawBase = import.meta.env.BASE_URL
const routerBasename =
  rawBase && rawBase !== '/' ? rawBase.replace(/\/$/, '') || undefined : undefined

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <EntryFlowProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="tickets" element={<AdminTicketsPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="submissions" element={<AdminSubmissionsPage />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>
          </Route>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="competitions" element={<CompetitionsPage />} />
            <Route path="archive/ronaldo-shirt-giveaway" element={<KickupsArchivePage />} />
            <Route path="archive/35-kickups" element={<Navigate to="/archive/ronaldo-shirt-giveaway" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </EntryFlowProvider>
    </BrowserRouter>
  )
}
