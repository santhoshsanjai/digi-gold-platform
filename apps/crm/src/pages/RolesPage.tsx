import { useMemo, useState } from 'react'
import { Button, Checkbox, Form, Modal, Popconfirm, Space, Table } from 'antd'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '../components/common/PageHeader.tsx'
import { Card } from '../components/ui/Card.tsx'
import InputContainer from '../shared-components/InputContainer.tsx'
import { useAuth } from '../providers/authContext.ts'
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  usePermissionCatalogueQuery,
  useRolesQuery,
  useUpdateRoleMutation,
} from '../store/api/adminApi.ts'
import type { Role } from '../api/types.ts'
import { errorMessage } from '../utils/errors.ts'

interface RoleForm {
  name: string
  description: string
}

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Add',
  edit: 'Edit',
  delete: 'Delete',
}

export default function RolesPage() {
  const { can } = useAuth()
  const { data: roles, isFetching } = useRolesQuery()
  const { data: catalogue } = usePermissionCatalogueQuery()
  const [createRole, { isLoading: creating }] = useCreateRoleMutation()
  const [updateRole, { isLoading: updating }] = useUpdateRoleMutation()
  const [deleteRole] = useDeleteRoleMutation()
  const [form] = Form.useForm<RoleForm>()
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [perms, setPerms] = useState<Set<string>>(new Set())

  // Menu labels name the modules the way staff see them in the side menu.
  const moduleLabel = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const m of catalogue?.menu ?? []) {
      const permission = String(m.permission ?? '')
      labels[permission.split(':')[0]] = String(m.label ?? '')
    }
    return (module: string) => labels[module] ?? module
  }, [catalogue])

  const locked = editing !== 'new' && editing?.is_system
  const canSave = editing === 'new' ? can('roles:create') : can('roles:edit')

  const open = (role: Role | 'new') => {
    form.setFieldsValue(
      role === 'new' ? { name: '', description: '' } : { name: role.name, description: role.description },
    )
    setPerms(new Set(role === 'new' ? [] : role.permissions))
    setEditing(role)
  }

  const toggle = (perm: string, on: boolean) => {
    const next = new Set(perms)
    const [module, action] = perm.split(':')
    if (on) {
      next.add(perm)
      // Doing anything on a page needs seeing it.
      if (action !== 'view') next.add(`${module}:view`)
    } else {
      next.delete(perm)
      if (action === 'view') {
        for (const a of catalogue?.actions ?? []) next.delete(`${module}:${a}`)
      }
    }
    setPerms(next)
  }

  const onFinish = async (v: RoleForm) => {
    const body = { ...v, permissions: [...perms].sort() }
    try {
      if (editing === 'new') {
        await createRole(body).unwrap()
        toast.success(`Role ${v.name} added`)
      } else if (editing) {
        await updateRole({
          id: editing.id,
          body: editing.is_system ? { description: v.description } : body,
        }).unwrap()
        toast.success('Role saved. Users see the change next time they load the page.')
      }
      setEditing(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async (role: Role) => {
    try {
      await deleteRole(role.id).unwrap()
      toast.success(`Role ${role.name} deleted`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns = [
    {
      title: 'Role',
      key: 'name',
      render: (_: unknown, r: Role) => (
        <div>
          <div className="font-medium flex items-center gap-1">
            {r.name} {r.is_system && <Lock size={14} className="text-slate-400" />}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{r.description}</div>
        </div>
      ),
    },
    { title: 'Users', dataIndex: 'user_count', align: 'right' as const },
    {
      title: 'Pages',
      key: 'pages',
      render: (_: unknown, r: Role) => r.permissions.filter((p) => p.endsWith(':view')).length,
      align: 'right' as const,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: Role) => (
        <Space>
          <Button size="small" onClick={() => open(r)}>
            {can('roles:edit') ? 'Edit' : 'View'}
          </Button>
          {can('roles:delete') && !r.is_system && (
            <Popconfirm
              title={`Delete ${r.name}?`}
              description={r.user_count ? 'Move its users to another role first.' : undefined}
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(r)}
            >
              <Button size="small" danger>
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const grid = catalogue && (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 dark:text-slate-400">
          <th className="py-2 font-medium">Page</th>
          {catalogue.actions.map((a) => (
            <th key={a} className="py-2 font-medium text-center">
              {ACTION_LABELS[a] ?? a}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {catalogue.modules.map((m) => (
          <tr key={m} className="border-t border-slate-100 dark:border-slate-800">
            <td className="py-2">{moduleLabel(m)}</td>
            {catalogue.actions.map((a) => {
              const perm = `${m}:${a}`
              return (
                <td key={a} className="py-2 text-center">
                  <Checkbox
                    checked={perms.has(perm)}
                    disabled={locked || !canSave}
                    onChange={(e) => toggle(perm, e.target.checked)}
                    aria-label={`${moduleLabel(m)}: ${ACTION_LABELS[a] ?? a}`}
                  />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <>
      <PageHeader
        title="Roles"
        description="A role decides which pages appear in the side menu and what staff can do on them."
        actions={
          can('roles:create') && (
            <Button type="primary" onClick={() => open('new')}>
              Add role
            </Button>
          )
        }
      />
      <Card className="p-0!">
        <Table<Role>
          rowKey="id"
          columns={columns}
          dataSource={roles}
          loading={isFetching}
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>

      <Modal
        title={editing === 'new' ? 'Add role' : locked ? `${editing?.name} (all permissions)` : 'Edit role'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Save"
        okButtonProps={{ disabled: !canSave }}
        confirmLoading={creating || updating}
        width={640}
        forceRender
      >
        <Form<RoleForm>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          disabled={!canSave}
          requiredMark={false}
        >
          <InputContainer type="input" name="name" label="Name" required disabled={locked} />
          <InputContainer type="textarea" name="description" label="Description" rows={2} />
        </Form>
        {locked && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The Owner role always has every permission so the account can never be locked out.
          </p>
        )}
        {grid}
      </Modal>
    </>
  )
}
