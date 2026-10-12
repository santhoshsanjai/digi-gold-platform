import { useState } from 'react'
import { Button, Form, Modal, Table } from 'antd'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { useAuth } from '../providers/authContext.ts'
import {
  useCreateStoreMutation,
  useStoresQuery,
  useUpdateStoreMutation,
} from '../store/api/adminApi.ts'
import type { Store } from '../api/types.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'

interface StoreForm {
  name: string
  address?: string
  phone?: string
  is_active?: boolean
}

export default function StoresPage() {
  const { can } = useAuth()
  const { data, isFetching } = useStoresQuery()
  const [createStore, { isLoading: creating }] = useCreateStoreMutation()
  const [updateStore, { isLoading: updating }] = useUpdateStoreMutation()
  const [form] = Form.useForm<StoreForm>()
  const [editing, setEditing] = useState<Store | 'new' | null>(null)

  const open = (s: Store | 'new') => {
    form.setFieldsValue(
      s === 'new'
        ? { name: '', address: '', phone: '', is_active: true }
        : { name: s.name, address: s.address, phone: s.phone, is_active: s.is_active },
    )
    setEditing(s)
  }

  const onFinish = async (v: StoreForm) => {
    try {
      if (editing === 'new') {
        await createStore({ name: v.name, address: v.address ?? '', phone: v.phone ?? '' }).unwrap()
        toast.success(`${v.name} added`)
      } else if (editing) {
        await updateStore({ id: editing.id, body: v }).unwrap()
        toast.success('Store saved')
      }
      setEditing(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns = [
    { title: 'Store', dataIndex: 'name', render: (n: string) => <span className="font-medium">{n}</span> },
    { title: 'Address', dataIndex: 'address' },
    { title: 'Phone', dataIndex: 'phone' },
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (a: boolean) => <StatusBadge status={a ? 'active' : 'inactive'} />,
    },
    ...(can('stores:edit')
      ? [
          {
            title: '',
            key: 'actions',
            render: (_: unknown, s: Store) => (
              <Button size="small" onClick={() => open(s)}>
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Stores"
        description="Showrooms where customers redeem their gold."
        actions={
          can('stores:create') && (
            <Button type="primary" onClick={() => open('new')}>
              Add store
            </Button>
          )
        }
      />
      <Card className="p-0!">
        <Table<Store>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={isFetching}
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>
      <Modal
        title={editing === 'new' ? 'Add store' : 'Edit store'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Save"
        confirmLoading={creating || updating}
        forceRender
      >
        <Form<StoreForm> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <InputContainer type="input" name="name" label="Name" required />
          <InputContainer type="textarea" name="address" label="Address" rows={2} />
          <InputContainer type="input" name="phone" label="Phone" />
          {editing !== 'new' && <InputContainer type="switch" name="is_active" label="Open" />}
        </Form>
      </Modal>
    </>
  )
}
