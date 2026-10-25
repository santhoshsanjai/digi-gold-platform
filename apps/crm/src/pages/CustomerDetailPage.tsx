import { Alert, Button, Descriptions, Popconfirm, Skeleton, Table, Tabs, Tooltip } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import { StatCard } from '@digigold/web-common/components/ui/StatCard.tsx'
import { useAuth } from '../providers/authContext.ts'
import {
  useCustomerQuery,
  usePaymentsQuery,
  useRedemptionsQuery,
  useSendCustomerTempPasswordMutation,
} from '../store/api/goldApi.ts'
import type { LedgerEntry, Lot, Payment, Redemption } from '../api/types.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDate, formatDateTime, formatGrams, formatInr } from '@digigold/web-common/utils/format.ts'

const ENTRY_LABELS: Record<string, string> = {
  credit: 'Bought',
  redeem: 'Redeemed',
  refund: 'Refunded',
}

export default function CustomerDetailPage() {
  const { customerId = '' } = useParams()
  const { can } = useAuth()
  const { data, isLoading, error } = useCustomerQuery(customerId)
  const [sendTempPassword, sending] = useSendCustomerTempPasswordMutation()
  const payments = usePaymentsQuery(
    { customer_id: customerId, limit: 50 },
    { skip: !can('payments:view') },
  )
  const redemptions = useRedemptionsQuery(
    { customer_id: customerId, limit: 50 },
    { skip: !can('redemptions:view') },
  )

  if (error) return <Alert type="error" showIcon title={errorMessage(error)} />
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 10 }} />
  const c = data.customer

  const sendTemp = async () => {
    try {
      const { sent_to } = await sendTempPassword(c.id).unwrap()
      toast.success(`A temporary password was emailed to ${sent_to}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const lotColumns = [
    { title: 'Bought on', dataIndex: 'paid_at', render: formatDate },
    { title: 'Grams', dataIndex: 'grams', align: 'right' as const, render: formatGrams },
    { title: 'Paid', dataIndex: 'amount_inr', align: 'right' as const, render: formatInr },
    { title: 'Rate', dataIndex: 'rate_per_gram', align: 'right' as const, render: formatInr },
    { title: 'Redeemable from', dataIndex: 'redeemable_at', render: formatDate },
    { title: 'Expires', dataIndex: 'expires_at', render: formatDate },
  ]
  const entryColumns = [
    { title: 'When', dataIndex: 'created_at', render: formatDateTime },
    { title: 'Entry', dataIndex: 'kind', render: (k: string) => ENTRY_LABELS[k] ?? k },
    { title: 'Grams', dataIndex: 'grams', align: 'right' as const, render: formatGrams },
    { title: 'Amount', dataIndex: 'amount_inr', align: 'right' as const, render: formatInr },
    { title: 'Note', dataIndex: 'note' },
  ]
  const paymentColumns = [
    { title: 'When', dataIndex: 'created_at', render: formatDateTime },
    { title: 'Amount', dataIndex: 'amount_inr', align: 'right' as const, render: formatInr },
    { title: 'Grams quoted', dataIndex: 'quoted_grams', align: 'right' as const, render: formatGrams },
    { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusBadge status={s} /> },
    { title: 'Reason', dataIndex: 'failure_reason' },
  ]
  const redemptionColumns = [
    {
      title: 'Slip',
      dataIndex: 'slip_number',
      render: (s: string, r: Redemption) => <Link to={`/redemptions/${r.id}/slip`}>{s}</Link>,
    },
    { title: 'When', dataIndex: 'created_at', render: formatDateTime },
    { title: 'Grams', dataIndex: 'grams', align: 'right' as const, render: formatGrams },
    { title: 'Paid in', dataIndex: 'amount_paid_inr', align: 'right' as const, render: formatInr },
  ]

  return (
    <>
      <PageHeader
        title={c.name || c.phone}
        description={<Link to="/customers">← All customers</Link>}
        actions={
          can('customers:edit') && (
            <Tooltip title={c.email ? undefined : 'The customer must add an email in the app first'}>
              <Popconfirm
                title="Send a temporary password?"
                description={`It is emailed to ${c.email}. The customer signs in to the app with it and must then choose a new password.`}
                okText="Send"
                onConfirm={sendTemp}
                disabled={!c.email || !c.is_active}
              >
                <Button loading={sending.isLoading} disabled={!c.email || !c.is_active}>
                  Send temporary password
                </Button>
              </Popconfirm>
            </Tooltip>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Gold balance" value={formatGrams(c.gold_grams)} />
        <StatCard
          title="Rupee balance"
          value={formatInr(c.rupee_balance_inr)}
          change="Carried into the next purchase"
        />
        <StatCard title="Total paid" value={formatInr(c.total_paid_inr)} />
      </div>
      <Card className="mb-6">
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
          <Descriptions.Item label="Phone">{c.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{c.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="PAN">
            {c.pan ? `${c.pan} ${c.pan_verified ? '(verified)' : '(not verified)'}` : 'Not given'}
          </Descriptions.Item>
          <Descriptions.Item label="Joined">{formatDate(c.created_at)}</Descriptions.Item>
          <Descriptions.Item label="Last sign-in">{formatDateTime(c.last_login_at)}</Descriptions.Item>
          <Descriptions.Item label="App sign-in">
            {c.has_password ? 'Email and password' : 'Mobile code only'}
          </Descriptions.Item>
          <Descriptions.Item label="Account">
            <StatusBadge status={c.is_active ? 'active' : 'inactive'} />
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card className="pt-2!">
        <Tabs
          items={[
            {
              key: 'lots',
              label: `Open lots (${data.open_lots.length})`,
              children: (
                <Table<Lot>
                  rowKey="id"
                  size="small"
                  columns={lotColumns}
                  dataSource={data.open_lots}
                  pagination={false}
                  scroll={{ x: 700 }}
                />
              ),
            },
            {
              key: 'ledger',
              label: 'Statement',
              children: (
                <Table<LedgerEntry>
                  rowKey="id"
                  size="small"
                  columns={entryColumns}
                  dataSource={data.recent_entries}
                  pagination={false}
                  scroll={{ x: 700 }}
                />
              ),
            },
            ...(can('payments:view')
              ? [
                  {
                    key: 'payments',
                    label: 'Payments',
                    children: (
                      <Table<Payment>
                        rowKey="id"
                        size="small"
                        columns={paymentColumns}
                        dataSource={payments.data?.items}
                        loading={payments.isFetching}
                        pagination={false}
                        scroll={{ x: 700 }}
                      />
                    ),
                  },
                ]
              : []),
            ...(can('redemptions:view')
              ? [
                  {
                    key: 'redemptions',
                    label: 'Redemptions',
                    children: (
                      <Table<Redemption>
                        rowKey="id"
                        size="small"
                        columns={redemptionColumns}
                        dataSource={redemptions.data?.items}
                        loading={redemptions.isFetching}
                        pagination={false}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </>
  )
}
