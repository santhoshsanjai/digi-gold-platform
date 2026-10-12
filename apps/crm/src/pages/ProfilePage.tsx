import { Button, Descriptions, Form } from 'antd'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { useAuth } from '../providers/authContext.ts'
import { useChangePasswordMutation } from '../store/api/authApi.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { confirmPasswordRules, passwordRules } from '@digigold/web-common/utils/validation.ts'

interface ChangeForm {
  current_password: string
  new_password: string
  confirm: string
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const [change, { isLoading }] = useChangePasswordMutation()
  const [form] = Form.useForm<ChangeForm>()
  const navigate = useNavigate()

  const onFinish = async ({ current_password, new_password }: ChangeForm) => {
    try {
      await change({ current_password, new_password }).unwrap()
      // The API ends every session when the password changes.
      toast.success('Password changed. Sign in again with the new password.')
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mt-0 mb-4 text-base font-semibold">Your account</h3>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Name">{user?.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
            <Descriptions.Item label="Pages you can open">
              {user?.menu.map((m) => m.label).join(', ') || 'None'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card>
          <h3 className="mt-0 mb-4 text-base font-semibold">Change password</h3>
          <Form<ChangeForm> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
            <InputContainer
              type="password"
              name="current_password"
              label="Current password"
              required
            />
            <InputContainer
              type="password"
              name="new_password"
              label="New password"
              required
              rules={passwordRules}
              autoComplete="new-password"
            />
            <InputContainer
              type="password"
              name="confirm"
              label="Confirm new password"
              dependencies={['new_password']}
              rules={confirmPasswordRules()}
              autoComplete="new-password"
            />
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Change password
            </Button>
          </Form>
        </Card>
      </div>
    </>
  )
}
