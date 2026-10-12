import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { FullPageSpinner } from '@digigold/web-common/components/FullPageSpinner.tsx'
import { AuthLayout } from '../layouts/AuthLayout.tsx'
import { MainLayout } from '../layouts/MainLayout.tsx'
import { NotFoundPage } from '../pages/NotFoundPage.tsx'
import { RedirectIfSignedIn, RequireAuth, RequirePermission } from './guards.tsx'

// Each page is its own chunk, so staff only download the screens they open.
const page = (load: () => Promise<{ default: ComponentType }>) => {
  const Page = lazy(load)
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Page />
    </Suspense>
  )
}

const guarded = (permission: string, load: () => Promise<{ default: ComponentType }>) => (
  <RequirePermission permission={permission}>{page(load)}</RequirePermission>
)

export const appRouter = createBrowserRouter([
  {
    element: (
      <RedirectIfSignedIn>
        <AuthLayout />
      </RedirectIfSignedIn>
    ),
    children: [
      { path: 'login', element: page(() => import('../pages/auth/LoginPage.tsx')) },
      { path: 'first-login', element: page(() => import('../pages/auth/FirstLoginPage.tsx')) },
      {
        path: 'forgot-password',
        element: page(() => import('../pages/auth/ForgotPasswordPage.tsx')),
      },
    ],
  },
  {
    // Reachable signed in or out: the link arrives by email.
    element: <AuthLayout />,
    children: [
      {
        path: 'reset-password',
        element: page(() => import('../pages/auth/ResetPasswordPage.tsx')),
      },
    ],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: page(() => import('../pages/HomePage.tsx')) },
      { path: 'rates', element: guarded('rates:view', () => import('../pages/RatesPage.tsx')) },
      {
        path: 'customers',
        element: guarded('customers:view', () => import('../pages/CustomersPage.tsx')),
      },
      {
        path: 'customers/:customerId',
        element: guarded('customers:view', () => import('../pages/CustomerDetailPage.tsx')),
      },
      {
        path: 'payments',
        element: guarded('payments:view', () => import('../pages/PaymentsPage.tsx')),
      },
      {
        path: 'redemptions',
        element: guarded('redemptions:view', () => import('../pages/RedemptionsPage.tsx')),
      },
      {
        path: 'redemptions/:redemptionId/slip',
        element: guarded('redemptions:view', () => import('../pages/RedemptionSlipPage.tsx')),
      },
      {
        path: 'expiry',
        element: guarded('expiry:view', () => import('../pages/ExpiryPage.tsx')),
      },
      {
        path: 'reports',
        element: guarded('reports:view', () => import('../pages/ReportsPage.tsx')),
      },
      { path: 'users', element: guarded('users:view', () => import('../pages/UsersPage.tsx')) },
      { path: 'roles', element: guarded('roles:view', () => import('../pages/RolesPage.tsx')) },
      { path: 'stores', element: guarded('stores:view', () => import('../pages/StoresPage.tsx')) },
      {
        path: 'settings',
        element: guarded('settings:view', () => import('../pages/SettingsPage.tsx')),
      },
      { path: 'profile', element: page(() => import('../pages/ProfilePage.tsx')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
