import { App, Button, Descriptions, Form } from 'antd'
import { toast } from 'sonner'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDateTime } from '@digigold/web-common/utils/format.ts'
import type { Tenant } from '../../api/types.ts'
import { useUpdateTenantMutation } from '../../store/api/consoleApi.ts'

export function OverviewTab({ tenant }: { tenant: Tenant }) {
  const [update, { isLoading }] = useUpdateTenantMutation()
  const { modal } = App.useApp()
  const suspended = tenant.status === 'suspended'

  const rename = async ({ name }: { name: string }) => {
    try {
      await update({ tenantId: tenant.id, body: { name } }).unwrap()
      toast.success('Name saved')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const toggle = () =>
    modal.confirm({
      title: suspended ? `Reactivate ${tenant.name}?` : `Suspend ${tenant.name}?`,
      content: suspended
        ? 'Staff and customers can sign in again and the website goes back online.'
        : 'Staff and customers are signed out and cannot sign in, and the website goes offline. Their gold and records are kept.',
      okText: suspended ? 'Reactivate' : 'Suspend',
      okButtonProps: { danger: !suspended },
      onOk: async () => {
        try {
          await update({
            tenantId: tenant.id,
            body: { status: suspended ? 'active' : 'suspended' },
          }).unwrap()
          toast.success(suspended ? 'Client reactivated' : 'Client suspended')
        } catch (e) {
          toast.error(errorMessage(e))
        }
      },
    })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mt-0 text-base font-semibold">Details</h3>
        <Form
          layout="vertical"
          initialValues={{ name: tenant.name }}
          onFinish={rename}
          requiredMark={false}
        >
          <InputContainer type="input" name="name" label="Business name" required />
          <Button type="primary" htmlType="submit" loading={isLoading}>
            Save
          </Button>
        </Form>
        <Descriptions column={1} size="small" className="mt-6">
          <Descriptions.Item label="Address">{tenant.slug}</Descriptions.Item>
          <Descriptions.Item label="Created">{formatDateTime(tenant.created_at)}</Descriptions.Item>
          <Descriptions.Item label="Settings version">{tenant.config_version}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card>
        <h3 className="mt-0 text-base font-semibold">Access</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {suspended
            ? 'This client is suspended. Nobody can sign in to its app or CRM, and its website is offline.'
            : 'This client is live. Its staff use the CRM and its customers use the app and website.'}
        </p>
        <Button danger={!suspended} onClick={toggle} loading={isLoading}>
          {suspended ? 'Reactivate client' : 'Suspend client'}
        </Button>
      </Card>
    </div>
  )
}
