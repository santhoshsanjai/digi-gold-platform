import { Alert, Button, Form } from 'antd'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { useForgotPasswordMutation } from '../../store/api/authApi.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'

export default function ForgotPasswordPage() {
  const [forgot, { isLoading }] = useForgotPasswordMutation()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { email: string }) => {
    setError(null)
    try {
      await forgot(values).unwrap()
      setSentTo(values.email)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (sentTo) {
    return (
      <>
        <h2 className="text-lg font-semibold mt-0 mb-2">Check your email</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          If {sentTo} has an account, a link to reset the password is on its way. The link works
          once and expires soon.
        </p>
        <Link to="/login">Back to sign in</Link>
      </>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold mt-0 mb-1">Reset your password</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0 mb-4">
        Enter your work email and we will send you a reset link.
      </p>
      {error && <Alert type="error" title={error} showIcon className="mb-4" />}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <InputContainer type="email" name="email" label="Email" required autoFocus />
        <Button type="primary" htmlType="submit" block loading={isLoading} size="large">
          Send reset link
        </Button>
      </Form>
      <div className="mt-4 text-center text-sm">
        <Link to="/login">Back to sign in</Link>
      </div>
    </>
  )
}
