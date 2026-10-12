import { useState } from 'react'
import { Alert, Button, Input, Modal, Segmented, Select, Table } from 'antd'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '../components/common/PageHeader.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Badge } from '../components/ui/Badge.tsx'
import { useAuth } from '../providers/authContext.ts'
import { useSchemeSettingsQuery } from '../store/api/adminApi.ts'
import { useExpiringLotsQuery, useRefundLotMutation } from '../store/api/goldApi.ts'
import type { ExpiringLot } from '../api/types.ts'
import { usePagination } from '../hooks/usePagination.ts'
import { errorMessage } from '../utils/errors.ts'
import { formatDate, formatGrams, formatInr } from '../utils/format.ts'

type View = 'expired' | 'expiring'

export default function ExpiryPage() {
  const { can } = useAuth()
  const [view, setView] = useState<View>('expired')
  const [withinDays, setWithinDays] = useState(30)
  const { params, pagination, reset } = usePagination()
  const { data, isFetching } = useExpiringLotsQuery({
    ...params,
    state: view,
    within_days: view === 'expiring' ? withinDays : undefined,
  })
  // Only roles that can read settings know whether refunds are on; others see the button
  // and get the API's answer.
  const settings = useSchemeSettingsQuery(undefined, { skip: !can('settings:view') })
  const refundsOn = settings.data ? settings.data.manual_refund_enabled : true
  const [refund, { isLoading: refunding }] = useRefundLotMutation()
  const [refundLot, setRefundLot] = useState<ExpiringLot | null>(null)
  const [note, setNote] = useState('')

  const submitRefund = async () => {
    if (!refundLot) return
    try {
      await refund({ lotId: refundLot.lot_id, note: note.trim() }).unwrap()
      toast.success(`Refund of ${formatInr(refundLot.amount_inr)} recorded`)
      setRefundLot(null)
      setNote('')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      render: (_: unknown, l: ExpiringLot) => (
        <Link to={`/customers/${l.customer_id}`} className="font-medium">
          {l.customer_name || 'No name'}
          <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
            {l.customer_phone}
          </div>
        </Link>
      ),
    },
    { title: 'Bought on', dataIndex: 'paid_at', render: formatDate },
    { title: 'Grams', dataIndex: 'grams', align: 'right' as const, render: formatGrams },
    { title: 'Paid', dataIndex: 'amount_inr', align: 'right' as const, render: formatInr },
    {
      title: view === 'expired' ? 'Expired' : 'Expires',
      key: 'expires',
      render: (_: unknown, l: ExpiringLot) => (
        <div>
          {formatDate(l.expires_at)}
          <div>
            <Badge variant={l.days_left < 0 ? 'danger' : l.days_left <= 7 ? 'warning' : 'neutral'}>
              {l.days_left < 0
                ? `${-l.days_left} days ago`
                : l.days_left === 0
                  ? 'Today'
                  : `In ${l.days_left} days`}
            </Badge>
          </div>
        </div>
      ),
    },
    { title: 'Last reminder', dataIndex: 'last_reminded_on', render: formatDate },
    ...(can('expiry:edit') && refundsOn
      ? [
          {
            title: '',
            key: 'actions',
            render: (_: unknown, l: ExpiringLot) => (
              <Button size="small" onClick={() => setRefundLot(l)}>
                Record refund
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Expiring lots"
        description="Each payment must be redeemed within its validity period. Customers get reminder emails before and after expiry."
      />
      {view === 'expired' && (data?.total ?? 0) > 0 && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title={`${data?.total} lot${data?.total === 1 ? ' has' : 's have'} passed the validity period`}
          description="Contact these customers to redeem in store. Advances held beyond 365 days can be treated as deposits under the law."
        />
      )}
      <Card className="p-0!">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Segmented<View>
            value={view}
            onChange={(v) => {
              setView(v)
              reset()
            }}
            options={[
              { label: 'Expired', value: 'expired' },
              { label: 'Expiring soon', value: 'expiring' },
            ]}
          />
          {view === 'expiring' && (
            <Select
              value={withinDays}
              onChange={(v) => {
                setWithinDays(v)
                reset()
              }}
              style={{ width: 160 }}
              options={[7, 30, 60, 90].map((d) => ({ label: `Within ${d} days`, value: d }))}
            />
          )}
        </div>
        <Table<ExpiringLot>
          rowKey="lot_id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={pagination(data?.total)}
          rowClassName={(l) => (l.days_left < 0 ? 'bg-red-50/60 dark:bg-red-950/30' : '')}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="Record a refund"
        open={Boolean(refundLot)}
        okText="Record refund"
        okButtonProps={{ danger: true, loading: refunding, disabled: note.trim().length < 3 }}
        onOk={submitRefund}
        onCancel={() => setRefundLot(null)}
      >
        {refundLot && (
          <>
            <p>
              Use this only after the money has been returned to {refundLot.customer_name || refundLot.customer_phone}.
              The lot of {formatGrams(refundLot.grams)} ({formatInr(refundLot.amount_inr)}) is
              closed and cannot be redeemed afterwards.
            </p>
            <Input.TextArea
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How the money was returned, e.g. bank transfer ref 1234"
            />
          </>
        )}
      </Modal>
    </>
  )
}
