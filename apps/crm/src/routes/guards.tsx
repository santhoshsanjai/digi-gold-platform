import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Result } from 'antd'
import { FullPageSpinner } from '../components/common/FullPageSpinner.tsx'
import { useAuth } from '../providers/authContext.ts'

/** Sends signed-out visitors to the login page and back here afterwards. */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}

/** Pages are hidden from the menu by role too; this covers typed-in addresses. */
export const RequirePermission: React.FC<{ permission: string; children: React.ReactNode }> = ({
  permission,
  children,
}) => {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <Result
        status="403"
        title="No access"
        subTitle="Your role does not include this page. Ask your admin if you need it."
      />
    )
  }
  return <>{children}</>
}

/** Signed-in users who open /login go straight to the app. */
export const RedirectIfSignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <FullPageSpinner />
  if (isAuthenticated && user) return <Navigate to="/" replace />
  return <>{children}</>
}
