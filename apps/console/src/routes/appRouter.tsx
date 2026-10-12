import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { FullPageSpinner } from '@digigold/web-common/components/FullPageSpinner.tsx'
import { AuthLayout } from '../layouts/AuthLayout.tsx'
import { MainLayout } from '../layouts/MainLayout.tsx'
import { NotFoundPage } from '../pages/NotFoundPage.tsx'
import { RedirectIfSignedIn, RequireAdmin } from './guards.tsx'

const page = (load: () => Promise<{ default: ComponentType }>) => {
  const Page = lazy(load)
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Page />
    </Suspense>
  )
}

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
      <RequireAdmin>
        <MainLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <Navigate to="/clients" replace /> },
      { path: 'clients', element: page(() => import('../pages/ClientsPage.tsx')) },
      {
        path: 'clients/:tenantId',
        element: page(() => import('../pages/client/ClientPage.tsx')),
      },
      {
        path: 'clients/:tenantId/pages/:pageId',
        element: page(() => import('../pages/client/PageEditorPage.tsx')),
      },
      { path: 'profile', element: page(() => import('../pages/ProfilePage.tsx')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
