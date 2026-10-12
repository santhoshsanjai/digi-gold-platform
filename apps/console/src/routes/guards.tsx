import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Result } from 'antd'
import { FullPageSpinner } from '@digigold/web-common/components/FullPageSpinner.tsx'
import { useAuth } from '../providers/authContext.ts'

/** Only platform admins get past this; client staff accounts are sent to their CRM. */
export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user, signOut } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (!user.is_platform_admin) {
    return (
      <Result
        status="403"
        title="This is the platform owner's console"
        subTitle="Client staff sign in to their own CRM."
        extra={<button onClick={() => signOut()}>Sign out</button>}
      />
    )
  }
  return <>{children}</>
}

export const RedirectIfSignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <FullPageSpinner />
  if (isAuthenticated && user) return <Navigate to="/" replace />
  return <>{children}</>
}
