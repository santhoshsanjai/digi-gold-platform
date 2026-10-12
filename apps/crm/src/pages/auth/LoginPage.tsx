import { Alert, Button, Form } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import InputContainer from '../../shared-components/InputContainer.tsx'
import { useAuth } from '../../providers/authContext.ts'
import { useLoginMutation } from '../../store/api/authApi.ts'
import { errorMessage } from '../../utils/errors.ts'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const [login, { isLoading }] = useLoginMutation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const onFinish = async (values: LoginForm) => {
    setError(null)
    try {
      const result = await login(values).unwrap()
      if (result.status === 'password_change_required') {
        // Signed in with a temporary password: a permanent one is set before anything else.
        navigate('/first-login', {
          replace: true,
          state: { token: result.password_change_token, email: values.email, from },
        })
        return
      }
      signIn(result)
      navigate(from, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold mt-0 mb-4">Sign in</h2>
      {error && <Alert type="error" title={error} showIcon className="mb-4" />}
      <Form<LoginForm> layout="vertical" onFinish={onFinish} requiredMark={false}>
        <InputContainer
          type="email"
          name="email"
          label="Email"
          required
          autoFocus
          autoComplete="username"
        />
        <InputContainer
          type="password"
          name="password"
          label="Password"
          required
          autoComplete="current-password"
        />
        <Button type="primary" htmlType="submit" block loading={isLoading} size="large">
          Sign in
        </Button>
      </Form>
      <div className="mt-4 text-center text-sm">
        <Link to="/forgot-password">Forgot your password?</Link>
      </div>
    </>
  )
}
