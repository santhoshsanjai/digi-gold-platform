import { useState } from 'react'
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tooltip } from 'antd'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import { Badge } from '@digigold/web-common/components/ui/Badge.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { useAuth } from '../providers/authContext.ts'
import {
  useCreateUserMutation,
  useResendPasswordMutation,
  useRolesQuery,
  useStoresQuery,
  useUpdateUserMutation,
  useUsersQuery,
} from '../store/api/adminApi.ts'
import type { StaffUser } from '../api/types.ts'
import { useDebounced } from '@digigold/web-common/hooks/useDebounced.ts'
import { usePagination } from '@digigold/web-common/hooks/usePagination.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDateTime } from '@digigold/web-common/utils/format.ts'

interface UserForm {
  name: string
  email: string
  phone?: string
  role_id: string
  store_id?: string | null
  is_active?: boolean
}

export default function UsersPage() {
  const { can, user: me } = useAuth()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const { params, pagination, reset } = usePagination()
  const { data, isFetching } = useUsersQuery({ ...params, q: q || undefined })
  const roles = useRolesQuery(undefined, { skip: !can('roles:view') })
  const stores = useStoresQuery(undefined, { skip: !can('stores:view') })
  const [createUser, { isLoading: creating }] = useCreateUserMutation()
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation()
  const [resend] = useResendPasswordMutation()
  const [form] = Form.useForm<UserForm>()
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null)

  const roleName = (id: string | null) => roles.data?.find((r) => r.id === id)?.name ?? '—'
  const storeName = (id: string | null) =>
    id ? (stores.data?.find((s) => s.id === id)?.name ?? '—') : 'All stores'
  const roleOptions = (roles.data ?? []).map((r) => ({ label: r.name, value: r.id }))
  const storeOptions = (stores.data ?? [])
    .filter((s) => s.is_active)
    .map((s) => ({ label: s.name, value: s.id }))

  const openNew = () => {
    form.resetFields()
    setEditing('new')
  }
  const openEdit = (u: StaffUser) => {
    form.setFieldsValue({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role_id: u.role_id ?? undefined,
      store_id: u.store_id,
      is_active: u.is_active,
    })
    setEditing(u)
  }

  const onFinish = async (v: UserForm) => {
    try {
      if (editing === 'new') {
        await createUser({
          name: v.name,
          email: v.email,
          phone: v.phone ?? '',
          role_id: v.role_id,
          store_id: v.store_id ?? null,
        }).unwrap()
        toast.success(`${v.name} added. A temporary password was emailed to ${v.email}.`)
      } else if (editing) {
        const isSelf = editing.id === me?.id
        await updateUser({
          id: editing.id,
          body: {
            name: v.name,
            phone: v.phone ?? '',
            store_id: v.store_id ?? null,
            // The API refuses changing your own role or deactivating yourself.
            ...(isSelf ? {} : { role_id: v.role_id, is_active: v.is_active }),
          },
        }).unwrap()
        toast.success('User updated')
      }
      setEditing(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const resendPassword = async (u: StaffUser) => {
    try {
      await resend(u.id).unwrap()
      toast.success(`A new temporary password was emailed to ${u.email}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, u: StaffUser) => (
        <div>
          <div className="font-medium">
            {u.name} {u.id === me?.id && <Badge variant="neutral">You</Badge>}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
        </div>
      ),
    },
    { title: 'Role', dataIndex: 'role_id', render: roleName },
    { title: 'Store', dataIndex: 'store_id', render: storeName },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, u: StaffUser) =>
        !u.is_active ? (
          <StatusBadge status="inactive" />
        ) : u.must_change_password ? (
          <Tooltip title="Has not set a password yet">
            <span>
              <Badge variant="warning">Invited</Badge>
            </span>
          </Tooltip>
        ) : (
          <StatusBadge status="active" />
        ),
    },
    { title: 'Last sign-in', dataIndex: 'last_login_at', render: formatDateTime },
    ...(can('users:edit')
      ? [
          {
            title: '',
            key: 'actions',
            render: (_: unknown, u: StaffUser) => (
              <Space>
                <Button size="small" onClick={() => openEdit(u)}>
                  Edit
                </Button>
                {u.is_active && u.id !== me?.id && (
                  <Popconfirm
                    title="Send a new temporary password?"
                    description="Their current password stops working."
                    okText="Send"
                    onConfirm={() => resendPassword(u)}
                  >
                    <Button size="small">Reset password</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  const isSelf = editing !== 'new' && editing?.id === me?.id

  return (
    <>
      <PageHeader
        title="Users"
        description="Staff who can sign in to this CRM. New users get a temporary password by email."
        actions={
          can('users:create') && (
            <Button type="primary" onClick={openNew}>
              Add user
            </Button>
          )
        }
      />
      <Card className="p-0!">
        <div className="p-4">
          <Input
            allowClear
            prefix={<Search size={16} className="text-slate-400" />}
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              reset()
            }}
            className="max-w-sm"
          />
        </div>
        <Table<StaffUser>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={pagination(data?.total)}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={editing === 'new' ? 'Add user' : 'Edit user'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        okText={editing === 'new' ? 'Add and email password' : 'Save'}
        onOk={() => form.submit()}
        confirmLoading={creating || updating}
        destroyOnHidden
        forceRender
      >
        <Form<UserForm> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <InputContainer type="input" name="name" label="Full name" required />
          <InputContainer
            type="email"
            name="email"
            label="Email"
            required
            disabled={editing !== 'new'}
            notes={editing === 'new' ? 'The temporary password is sent here.' : undefined}
          />
          <InputContainer type="input" name="phone" label="Phone" />
          <InputContainer
            type="select"
            name="role_id"
            label="Role"
            required
            options={roleOptions}
            loading={roles.isLoading}
            disabled={isSelf}
            notes={isSelf ? 'You cannot change your own role.' : 'The role decides which pages they see.'}
          />
          <InputContainer
            type="select"
            name="store_id"
            label="Store"
            options={storeOptions}
            placeholder="All stores"
            notes="Store staff redeem only for their own store."
          />
          {editing !== 'new' && !isSelf && (
            <InputContainer type="switch" name="is_active" label="Can sign in" />
          )}
        </Form>
      </Modal>
    </>
  )
}
