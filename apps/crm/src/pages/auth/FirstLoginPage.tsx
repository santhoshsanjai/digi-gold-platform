import { Alert, Button, Form } from 'antd'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import InputContainer from '../../shared-components/InputContainer.tsx'
import { useAuth } from '../../providers/authContext.ts'
import { useFirstLoginMutation } from '../../store/api/authApi.ts'
import { errorMessage } from '../../utils/errors.ts'
import { confirmPasswordRules, passwordRules } from '../../utils/validation.ts'

interface FirstLoginState {
  token?: string
  email?: string
  from?: string
}

/** After signing in with the emailed temporary password, the user sets their own. */
export default function FirstLoginPage() {
  const state = (useLocation().state ?? {}) as FirstLoginState
  const [firstLogin, { isLoading }] = useFirstLoginMutation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  if (!state.token) return <Navigate to="/login" replace />

  const onFinish = async (values: { new_password: string }) => {
    setError(null)
    try {
      const tokens = await firstLogin({
        password_change_token: state.token!,
        new_password: values.new_password,
      }).unwrap()
      signIn(tokens)
      navigate(state.from ?? '/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold mt-0 mb-1">Set your password</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0 mb-4">
        You signed in with a temporary password{state.email ? ` for ${state.email}` : ''}. Choose
        a new one to continue.
      </p>
      {error && <Alert type="error" title={error} showIcon className="mb-4" />}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <InputContainer
          type="password"
          name="new_password"
          label="New password"
          required
          rules={passwordRules}
          autoFocus
          autoComplete="new-password"
          notes="At least 8 characters, with a letter and a number."
        />
        <InputContainer
          type="password"
          name="confirm"
          label="Confirm new password"
          dependencies={['new_password']}
          rules={confirmPasswordRules()}
          autoComplete="new-password"
        />
        <Button type="primary" htmlType="submit" block loading={isLoading} size="large">
          Save and continue
        </Button>
      </Form>
    </>
  )
}
