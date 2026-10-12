import { useState } from 'react'
import { Button, Form, Modal, Table } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDateTime } from '@digigold/web-common/utils/format.ts'
import type { SitePageCreate, SitePageSummary, Tenant, WebsiteSettings } from '../../api/types.ts'
import {
  useCreateSitePageMutation,
  useSaveWebsiteMutation,
  useSitePagesQuery,
  useWebsiteQuery,
} from '../../store/api/consoleApi.ts'
import { linkRule, pageSlugRule } from '../../utils/rules.ts'
import { slugify } from '../../utils/slug.ts'

export function WebsiteTab({ tenant }: { tenant: Tenant }) {
  return (
    <div className="grid gap-4">
      <PagesCard tenant={tenant} />
      <SettingsCard tenant={tenant} />
    </div>
  )
}

function PagesCard({ tenant }: { tenant: Tenant }) {
  const { data, isFetching } = useSitePagesQuery(tenant.id)
  const [create, { isLoading }] = useCreateSitePageMutation()
  const [form] = Form.useForm<SitePageCreate>()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const editUrl = (id: string) => `/clients/${tenant.id}/pages/${id}`

  const onFinish = async (body: SitePageCreate) => {
    try {
      const page = await create({ tenantId: tenant.id, body }).unwrap()
      setOpen(false)
      navigate(editUrl(page.id))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns = [
    {
      title: 'Page',
      dataIndex: 'title',
      render: (title: string, p: SitePageSummary) => (
        <Link to={editUrl(p.id)} className="font-medium">
          {title}
        </Link>
      ),
    },
    {
      title: 'Address',
      dataIndex: 'slug',
      render: (s: string) => <code>{s === 'home' ? '/' : `/${s}`}</code>,
    },
    {
      title: 'In menu',
      dataIndex: 'show_in_nav',
      render: (v: boolean, p: SitePageSummary) => (v ? `Yes (${p.nav_order})` : 'No'),
    },
    { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusBadge status={s} /> },
    { title: 'Last edited', dataIndex: 'updated_at', render: formatDateTime },
  ]

  return (
    <Card className="p-0!">
      <div className="flex items-center justify-between gap-2 p-4">
        <div>
          <h3 className="m-0 text-base font-semibold">Pages</h3>
          <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
            Edits stay in draft until you publish them.
          </p>
        </div>
        <Button
          type="primary"
          onClick={() => {
            form.resetFields()
            setOpen(true)
          }}
        >
          Add page
        </Button>
      </div>
      <Table<SitePageSummary>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isFetching}
        pagination={false}
        scroll={{ x: 600 }}
      />
      <Modal
        title="Add page"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Create and edit"
        confirmLoading={isLoading}
        forceRender
      >
        <Form<SitePageCreate>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ show_in_nav: true }}
          onFinish={onFinish}
          onValuesChange={(changed: Partial<SitePageCreate>) => {
            if ('title' in changed && !form.isFieldTouched('slug')) {
              form.setFieldValue('slug', slugify(changed.title ?? '', 80))
            }
          }}
        >
          <InputContainer type="input" name="title" label="Title" required />
          <InputContainer
            type="input"
            name="slug"
            label="Address"
            required
            rules={[pageSlugRule]}
            prefix="/"
          />
          <InputContainer type="switch" name="show_in_nav" label="Show in the menu" />
        </Form>
      </Modal>
    </Card>
  )
}

function SettingsCard({ tenant }: { tenant: Tenant }) {
  const { data, isLoading: loading } = useWebsiteQuery(tenant.id)
  const [save, { isLoading }] = useSaveWebsiteMutation()

  const onFinish = async (body: WebsiteSettings) => {
    try {
      await save({ tenantId: tenant.id, body }).unwrap()
      toast.success('Site settings saved and live')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (loading || !data) return null
  return (
    <Card>
      <h3 className="mt-0 text-base font-semibold">Site settings</h3>
      <p className="mt-0 text-sm text-slate-500 dark:text-slate-400">
        Shown on every page. These go live as soon as you save.
      </p>
      <Form<WebsiteSettings>
        layout="vertical"
        initialValues={data}
        onFinish={onFinish}
        requiredMark={false}
      >
        <div className="grid gap-x-4 md:grid-cols-2">
          <InputContainer type="input" name="site_title" label="Site title" placeholder={tenant.name} />
          <InputContainer type="input" name="tagline" label="Tagline" />
        </div>
        <InputContainer
          type="textarea"
          name="seo_description"
          label="Search engine description"
          rows={2}
          notes="One or two sentences shown under the site in search results."
        />
        <InputContainer type="textarea" name="footer_text" label="Footer text" rows={2} />

        <h4 className="text-sm font-semibold mt-2">Contact</h4>
        <InputContainer type="textarea" name={['contact', 'address']} label="Address" rows={2} />
        <div className="grid gap-x-4 md:grid-cols-3">
          <InputContainer type="input" name={['contact', 'phone']} label="Phone" />
          <InputContainer type="input" name={['contact', 'whatsapp']} label="WhatsApp" />
          <InputContainer type="email" name={['contact', 'email']} label="Email" />
        </div>
        <div className="grid gap-x-4 md:grid-cols-2">
          <InputContainer type="input" name={['contact', 'hours']} label="Opening hours" />
          <InputContainer
            type="input"
            name={['contact', 'map_url']}
            label="Map link"
            rules={[linkRule]}
            notes="A Google Maps embed or share link."
          />
        </div>

        <h4 className="text-sm font-semibold mt-2">Social and app links</h4>
        <div className="grid gap-x-4 md:grid-cols-2">
          {(['facebook', 'instagram', 'youtube', 'x'] as const).map((k) => (
            <InputContainer
              key={k}
              type="input"
              name={['social', k]}
              label={k === 'x' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1)}
              rules={[linkRule]}
            />
          ))}
          <InputContainer
            type="input"
            name={['app_links', 'android']}
            label="Google Play link"
            rules={[linkRule]}
          />
          <InputContainer
            type="input"
            name={['app_links', 'ios']}
            label="App Store link"
            rules={[linkRule]}
          />
        </div>
        <Button type="primary" htmlType="submit" loading={isLoading}>
          Save site settings
        </Button>
      </Form>
    </Card>
  )
}
