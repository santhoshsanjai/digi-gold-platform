import { Alert, Button, Form, Result } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import InputContainer from '../../shared-components/InputContainer.tsx'
import { useAuth } from '../../providers/authContext.ts'
import { useResetPasswordMutation } from '../../store/api/authApi.ts'
import { errorMessage } from '../../utils/errors.ts'
import { confirmPasswordRules, passwordRules } from '../../utils/validation.ts'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [reset, { isLoading }] = useResetPasswordMutation()
  const { isAuthenticated, signOut } = useAuth()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <Result
        status="warning"
        title="This link is incomplete"
        subTitle="Open the link from the email again, or ask for a new one."
        extra={<Link to="/forgot-password">Request a new link</Link>}
      />
    )
  }

  const onFinish = async (values: { new_password: string }) => {
    setError(null)
    try {
      await reset({ token, new_password: values.new_password }).unwrap()
      // Resetting ends every session, including this browser's.
      if (isAuthenticated) await signOut()
      setDone(true)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (done) {
    return (
      <Result
        status="success"
        title="Password changed"
        subTitle="Sign in with your new password."
        extra={<Link to="/login">Go to sign in</Link>}
      />
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold mt-0 mb-4">Choose a new password</h2>
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
          Save password
        </Button>
      </Form>
    </>
  )
}
