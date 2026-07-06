import { Analytics } from '@vercel/analytics/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SiteAnalytics } from './components/SiteAnalytics'
import { SiteLocaleProvider } from './i18n/SiteLocaleProvider.jsx'
import { EntryFlowProvider } from './entry/EntryFlowProvider'
import { AdminThemeProvider } from './admin/AdminThemeContext'
import { AdminLayout } from './admin/AdminLayout'
import { EofAdminLayout } from './admin/EofAdminLayout'
import { EditorLayout } from './editor/EditorLayout'
import { RequireAdmin } from './admin/RequireAdmin'
import { Layout } from './components/Layout'
import { UserAuthProvider } from './auth/UserAuthProvider'
import { RequireUser } from './auth/RequireUser'
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
import AdminCompetitionsAdminPage from './pages/admin/CompetitionsAdminPage'
import AdminGiveawaysAdminPage from './pages/admin/GiveawaysAdminPage'
import AdminDrawWinnerPage from './pages/admin/DrawWinnerPage'
import AdminWorldCupBallDrawPage from './pages/admin/WorldCupBallDrawPage'
import AdminWorldCupBallFailedAttemptsPage from './pages/admin/WorldCupBallFailedAttemptsPage'
import AdminEntryAttemptsPage from './pages/admin/EntryAttemptsPage'
import AdminThemeDesignerPage from './pages/admin/ThemeDesignerPage'
import AdminPageEditorPage from './pages/admin/PageEditorPage'
import ContactPage from './pages/ContactPage'
import AccountPage from './pages/AccountPage'
import AuthModalRedirect from './pages/AuthModalRedirect'
import FaqPage from './pages/FaqPage'
import NewsletterPage from './pages/NewsletterPage'
import NewsletterPreferencesPage from './pages/NewsletterPreferencesPage'
import NewsletterUnsubscribePage from './pages/NewsletterUnsubscribePage'
import AdminNewsletterPage from './pages/admin/NewsletterPage'
import { PurchaseEmailPreview } from './components/admin/PurchaseEmailPreview'
import PrizeRevealPage from './pages/PrizeRevealPage'
import ShirtPrizeRevealPage from './pages/ShirtPrizeRevealPage'
import WorldCupBallGiveawayPage from './pages/WorldCupBallGiveawayPage'
import AdminSiteVisitsPage from './pages/admin/SiteVisitsPage'
import EyesOfFootballAdminPage from './pages/admin/EyesOfFootballAdminPage'
import { isShowSkillsStagingClientEnabled } from '../shared/stagingSite.mjs'

const rawBase = import.meta.env.BASE_URL
const routerBasename =
  rawBase && rawBase !== '/' ? rawBase.replace(/\/$/, '') || undefined : undefined

export default function App() {
  return (
    <>
      <Analytics />
      <BrowserRouter basename={routerBasename}>
      <SiteLocaleProvider>
      <EntryFlowProvider>
        <SiteAnalytics />
        <Routes>
          <Route path="/prize-reveal" element={<PrizeRevealPage />} />
          <Route path="/shirt-prize-preview" element={<ShirtPrizeRevealPage />} />
          {import.meta.env.DEV ? (
            <Route
              path="/dev/email-preview"
              element={
                <div className="min-h-svh bg-stone-50 px-4 py-8 text-stone-800 sm:px-8">
                  <div className="ss-admin mx-auto max-w-6xl">
                    <p className="mb-6 text-sm text-amber-800">
                      Local dev only — same previews as{' '}
                      <span className="font-mono text-stone-400">/admin/test-email</span> (no login).
                      Winner delivery form after a perfect score:{' '}
                      <a href="/?preview-wc-ball=won" className="font-mono text-amber-700 underline">
                        /?preview-wc-ball=won
                      </a>
                    </p>
                    <PurchaseEmailPreview />
                  </div>
                </div>
              }
            />
          ) : null}
          <Route path="/admin" element={<AdminThemeProvider />}>
            <Route path="login" element={<AdminLoginPage />} />
            <Route element={<RequireAdmin />}>
              <Route element={<EditorLayout />}>
                <Route path="editor" element={<AdminPageEditorPage />} />
              </Route>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="competitions" element={<AdminCompetitionsAdminPage />} />
                <Route path="giveaways" element={<AdminGiveawaysAdminPage />} />
                <Route path="pages" element={<Navigate to="/admin/editor" replace />} />
                <Route path="homepage" element={<Navigate to="/admin/editor" replace />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="tickets" element={<AdminTicketsPage />} />
                <Route path="draw" element={<AdminDrawWinnerPage />} />
                <Route path="world-cup-ball-draw" element={<AdminWorldCupBallDrawPage />} />
                <Route path="world-cup-ball-failed" element={<AdminWorldCupBallFailedAttemptsPage />} />
                <Route path="site-visits" element={<AdminSiteVisitsPage />} />
                <Route path="entry-attempts" element={<AdminEntryAttemptsPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="submissions" element={<AdminSubmissionsPage />} />
                <Route path="test-email" element={<AdminTestEmailPage />} />
                <Route path="newsletter" element={<AdminNewsletterPage />} />
                <Route path="theme" element={<AdminThemeDesignerPage />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Route>
              {isShowSkillsStagingClientEnabled() ? (
                <Route element={<EofAdminLayout />}>
                  <Route path="eyes-of-football" element={<EyesOfFootballAdminPage />} />
                </Route>
              ) : null}
            </Route>
          </Route>
          <Route
            path="/"
            element={
              <UserAuthProvider>
                <Layout />
              </UserAuthProvider>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="competitions" element={<CompetitionsPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="login" element={<AuthModalRedirect view="login" />} />
            <Route path="register" element={<AuthModalRedirect view="register" />} />
            <Route path="forgot-password" element={<AuthModalRedirect view="forgot" />} />
            <Route element={<RequireUser />}>
              <Route path="account" element={<AccountPage />} />
            </Route>
            <Route path="newsletter" element={<NewsletterPage />} />
            <Route path="newsletter/preferences" element={<NewsletterPreferencesPage />} />
            <Route path="newsletter/unsubscribe" element={<NewsletterUnsubscribePage />} />
            <Route path="archive/ronaldo-shirt-giveaway" element={<KickupsArchivePage />} />
            <Route path="world-cup-ball-giveaway" element={<WorldCupBallGiveawayPage />} />
            <Route path="archive/35-kickups" element={<Navigate to="/archive/ronaldo-shirt-giveaway" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </EntryFlowProvider>
      </SiteLocaleProvider>
    </BrowserRouter>
    </>
  )
}
