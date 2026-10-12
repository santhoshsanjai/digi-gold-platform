import { Alert, Skeleton } from 'antd'
import { AlarmClock, Coins, IndianRupee, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatCard } from '@digigold/web-common/components/ui/StatCard.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import { Badge } from '@digigold/web-common/components/ui/Badge.tsx'
import { useAuth } from '../providers/authContext.ts'
import { useDashboardQuery } from '../store/api/goldApi.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatGrams, formatInr } from '@digigold/web-common/utils/format.ts'

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardQuery(undefined, { pollingInterval: 60_000 })
  const { can } = useAuth()

  if (error) return <Alert type="error" showIcon title={errorMessage(error)} />
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 8 }} />

  return (
    <>
      <PageHeader title="Dashboard" description="Today at a glance" />

      {!data.buying_open && (
        <Alert
          className="mb-6"
          type="warning"
          showIcon
          title="Customers cannot buy gold right now"
          description={data.buying_reason}
          action={can('rates:create') ? <Link to="/rates">Go to gold rate</Link> : undefined}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          title={`Today's ${data.purity} rate`}
          value={data.rate_per_gram ? `${formatInr(data.rate_per_gram)}/g` : 'Not set'}
          change={
            <Badge variant={data.buying_open ? 'success' : 'warning'}>
              {data.buying_open ? 'Buying open' : 'Buying closed'}
            </Badge>
          }
          icon={<Coins size={22} />}
        />
        <StatCard
          title="Collected today"
          value={formatInr(data.collections_today_inr)}
          change={`${data.payments_today} payment${data.payments_today === 1 ? '' : 's'}`}
          icon={<IndianRupee size={22} />}
        />
        <StatCard
          title="Gold held for customers"
          value={formatGrams(data.outstanding_grams)}
          change={
            data.outstanding_value_inr ? `Worth ${formatInr(data.outstanding_value_inr)} today` : undefined
          }
          icon={<Coins size={22} />}
        />
        <StatCard title="Customers" value={data.customers.toLocaleString('en-IN')} icon={<Users size={22} />} />
      </div>

      <Card>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
            <AlarmClock size={22} />
          </div>
          <div className="flex-1">
            <h3 className="m-0 text-base font-semibold">Lots past or near 365 days</h3>
            <p className="mt-1 mb-3 text-sm text-slate-500 dark:text-slate-400">
              Customers must redeem within the validity period. Reminders go out by email
              automatically.
            </p>
            <div className="flex flex-wrap gap-3">
              <Badge variant={data.lots_expired ? 'danger' : 'neutral'}>
                {data.lots_expired} expired
              </Badge>
              <Badge variant={data.lots_expiring_30_days ? 'warning' : 'neutral'}>
                {data.lots_expiring_30_days} expiring in 30 days
              </Badge>
              {can('expiry:view') && <Link to="/expiry">Review lots</Link>}
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}
