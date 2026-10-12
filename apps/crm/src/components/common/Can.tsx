import React from 'react'
import { useAuth } from '../../providers/authContext.ts'

/** Renders children only when the signed-in user's role has the permission. */
export const Can: React.FC<{ permission: string; children: React.ReactNode }> = ({
  permission,
  children,
}) => {
  const { can } = useAuth()
  return can(permission) ? <>{children}</> : null
}
