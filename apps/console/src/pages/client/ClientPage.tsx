import { Button, Result, Spin, Tabs } from 'antd'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { crmUrl } from '../../config/env.ts'
import { useTenantQuery } from '../../store/api/consoleApi.ts'
import { BrandingTab } from './BrandingTab.tsx'
import { FeaturesTab } from './FeaturesTab.tsx'
import { ImagesTab } from './ImagesTab.tsx'
import { OverviewTab } from './OverviewTab.tsx'
import { WebsiteTab } from './WebsiteTab.tsx'

const TABS = ['overview', 'branding', 'features', 'website', 'images'] as const

export default function ClientPage() {
  const { tenantId = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const { data: tenant, isLoading, error } = useTenantQuery(tenantId)
  const tab = TABS.find((t) => t === search.get('tab')) ?? 'overview'

  if (isLoading) return <Spin className="block! mx-auto! mt-16!" />
  if (!tenant) {
    return (
      <Result
        status="404"
        title="Client not found"
        subTitle={errorMessage(error)}
        extra={<Link to="/clients">Back to clients</Link>}
      />
    )
  }

  return (
    <>
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm mb-2">
        <ArrowLeft size={14} /> Clients
      </Link>
      <PageHeader
        title={tenant.name}
        description={
          <span className="inline-flex items-center gap-2">
            <code>{tenant.slug}</code> <StatusBadge status={tenant.status} />
          </span>
        }
        actions={
          <Button
            href={crmUrl(tenant.slug)}
            target="_blank"
            rel="noreferrer"
            icon={<ExternalLink size={14} />}
          >
            Open CRM
          </Button>
        }
      />
      <Tabs
        activeKey={tab}
        onChange={(key) => setSearch({ tab: key }, { replace: true })}
        destroyOnHidden
        items={[
          { key: 'overview', label: 'Overview', children: <OverviewTab tenant={tenant} /> },
          { key: 'branding', label: 'Branding', children: <BrandingTab tenant={tenant} /> },
          { key: 'features', label: 'Features', children: <FeaturesTab tenant={tenant} /> },
          { key: 'website', label: 'Website', children: <WebsiteTab tenant={tenant} /> },
          { key: 'images', label: 'Images', children: <ImagesTab tenant={tenant} /> },
        ]}
      />
    </>
  )
}
