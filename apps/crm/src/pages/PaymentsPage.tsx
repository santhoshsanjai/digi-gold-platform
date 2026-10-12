import { useState } from 'react'
import { Segmented, Table } from 'antd'
import { Link } from 'react-router-dom'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import { usePaymentsQuery } from '../store/api/goldApi.ts'
import type { Payment, PaymentStatus } from '../api/types.ts'
import { usePagination } from '@digigold/web-common/hooks/usePagination.ts'
import { formatDateTime, formatGrams, formatInr } from '@digigold/web-common/utils/format.ts'

type Filter = PaymentStatus | 'all'

export default function PaymentsPage() {
  const [status, setStatus] = useState<Filter>('all')
  const { params, pagination, reset } = usePagination()
  const { data, isFetching } = usePaymentsQuery({
    ...params,
    status: status === 'all' ? undefined : status,
  })

  const columns = [
    { title: 'When', dataIndex: 'created_at', render: formatDateTime },
    {
      title: 'Customer',
      dataIndex: 'customer_id',
      render: (id: string) => <Link to={`/customers/${id}`}>View customer</Link>,
    },
    { title: 'Amount', dataIndex: 'amount_inr', align: 'right' as const, render: formatInr },
    {
      title: 'Rate',
      key: 'rate',
      align: 'right' as const,
      render: (_: unknown, p: Payment) => `${formatInr(p.rate_per_gram)} (${p.purity})`,
    },
    { title: 'Grams', dataIndex: 'quoted_grams', align: 'right' as const, render: formatGrams },
    { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusBadge status={s} /> },
    {
      title: 'Reference',
      key: 'ref',
      render: (_: unknown, p: Payment) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {p.provider === 'mock' ? 'Test payment' : p.provider}
          {p.provider_payment_id ? ` · ${p.provider_payment_id}` : ''}
          {p.failure_reason ? ` · ${p.failure_reason}` : ''}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Payments" description="Every payment customers started in the app." />
      <Card className="p-0!">
        <div className="p-4 overflow-x-auto">
          <Segmented<Filter>
            value={status}
            onChange={(v) => {
              setStatus(v)
              reset()
            }}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Paid', value: 'paid' },
              { label: 'Pending', value: 'pending' },
              { label: 'Failed', value: 'failed' },
              { label: 'Started', value: 'created' },
            ]}
          />
        </div>
        <Table<Payment>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={pagination(data?.total)}
          scroll={{ x: 900 }}
        />
      </Card>
    </>
  )
}
