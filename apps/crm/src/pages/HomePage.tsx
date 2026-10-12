import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { FullPageSpinner } from '../components/common/FullPageSpinner.tsx'
import { useAuth } from '../providers/authContext.ts'

const DashboardPage = lazy(() => import('./DashboardPage.tsx'))

/** The dashboard for roles that have it; otherwise the first page the role can open. */
export default function HomePage() {
  const { can, user } = useAuth()
  if (can('dashboard:view')) {
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <DashboardPage />
      </Suspense>
    )
  }
  const first = user?.menu.find((m) => m.path !== '/')
  return <Navigate to={first?.path ?? '/profile'} replace />
}
