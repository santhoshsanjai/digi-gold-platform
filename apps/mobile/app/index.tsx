import { Redirect } from 'expo-router'
import { useAuth } from '../src/auth/AuthProvider'

export default function Index() {
  const { status, notice } = useAuth()
  if (status === 'signedIn') return <Redirect href="/(tabs)" />
  if (status === 'passwordChange') return <Redirect href="/change-password" />
  // After a password change or an expired session, go straight to sign-in to show why.
  return <Redirect href={notice ? '/sign-in' : '/welcome'} />
}
