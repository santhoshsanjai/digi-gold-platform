import { useState } from 'react'
import { Button, Form, Modal, Table } from 'antd'
import type { Rule } from 'antd/es/form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { usePagination } from '@digigold/web-common/hooks/usePagination.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDate } from '@digigold/web-common/utils/format.ts'
import { useCreateTenantMutation, useTenantsQuery } from '../store/api/consoleApi.ts'
import type { Tenant, TenantCreate } from '../api/types.ts'
import { slugify } from '../utils/slug.ts'

const SLUG_RULE: Rule = {
  pattern: /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/,
  message: 'Lowercase letters, numbers and hyphens, 3 to 63 characters',
}

export default function ClientsPage() {
  const { params, pagination } = usePagination()
  const { data, isFetching } = useTenantsQuery(params)
  const [createTenant, { isLoading: creating }] = useCreateTenantMutation()
  const [form] = Form.useForm<TenantCreate>()
  const [open, setOpen] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const navigate = useNavigate()

  const start = () => {
    form.resetFields()
    setSlugTouched(false)
    setOpen(true)
  }

  const onValuesChange = (changed: Partial<TenantCreate>) => {
    if ('slug' in changed) setSlugTouched(true)
    if ('name' in changed && !slugTouched) form.setFieldValue('slug', slugify(changed.name ?? ''))
  }

  const onFinish = async (v: TenantCreate) => {
    try {
      const tenant = await createTenant(v).unwrap()
      toast.success(`${tenant.name} created. The owner's temporary password is on its way to ${v.owner_email}.`)
      setOpen(false)
      navigate(`/clients/${tenant.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns = [
    {
      title: 'Client',
      dataIndex: 'name',
      render: (name: string, t: Tenant) => (
        <Link to={`/clients/${t.id}`} className="font-medium">
          {name}
        </Link>
      ),
    },
    { title: 'Address', dataIndex: 'slug', render: (s: string) => <code>{s}</code> },
    { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusBadge status={s} /> },
    { title: 'Created', dataIndex: 'created_at', render: formatDate },
  ]

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every jeweller on the platform. Open one to set its branding, features and website."
        actions={
          <Button type="primary" onClick={start}>
            Add client
          </Button>
        }
      />
      <Card className="p-0!">
        <Table<Tenant>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={pagination(data?.total)}
          scroll={{ x: 600 }}
        />
      </Card>
      <Modal
        title="Add client"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Create client"
        confirmLoading={creating}
        forceRender
      >
        <Form<TenantCreate>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={onValuesChange}
          requiredMark={false}
        >
          <InputContainer type="input" name="name" label="Business name" required />
          <InputContainer
            type="input"
            name="slug"
            label="Address"
            required
            rules={[SLUG_RULE]}
            notes="Used in the client's web and CRM addresses. It can't be changed later."
          />
          <InputContainer type="input" name="owner_name" label="Owner's name" required />
          <InputContainer
            type="email"
            name="owner_email"
            label="Owner's email"
            required
            notes="The owner gets a temporary password here and sets their own on first sign-in."
          />
        </Form>
      </Modal>
    </>
  )
}
