import { useState } from 'react'
import { Button, DatePicker, Segmented, Statistic, Table, Tabs } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDate, formatGrams, formatInr } from '@digigold/web-common/utils/format.ts'
import type { HoldingsReport, ReportRange } from '../api/types.ts'
import {
  useCollectionsReportQuery,
  useHoldingsReportQuery,
  useLazyReportCsvQuery,
  useRedemptionsReportQuery,
} from '../store/api/goldApi.ts'

const DAY = 'YYYY-MM-DD'

/** Downloads a report as a CSV file that opens in Excel. */
function useCsv() {
  const [fetchCsv, { isFetching }] = useLazyReportCsvQuery()
  const download = async (report: string, params: Record<string, string>, name: string) => {
    try {
      const text = await fetchCsv({ report, params }).unwrap()
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` })
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  return { download, busy: isFetching }
}

function RangeBar({ range, onChange, children }: { range: ReportRange; onChange: (r: ReportRange) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <DatePicker.RangePicker
        allowClear={false}
        value={[dayjs(range.start), dayjs(range.end)]}
        disabledDate={(d: Dayjs) => d.isAfter(dayjs(), 'day')}
        onChange={(v) => v?.[0] && v[1] && onChange({ start: v[0].format(DAY), end: v[1].format(DAY) })}
      />
      {children}
    </div>
  )
}

const lastDays = (n: number): ReportRange => ({
  start: dayjs().subtract(n - 1, 'day').format(DAY),
  end: dayjs().format(DAY),
})

function Totals({ items }: { items: { title: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
      {items.map((i) => (
        <Statistic key={i.title} title={i.title} value={i.value} />
      ))}
    </div>
  )
}

function Collections() {
  const [range, setRange] = useState(() => lastDays(30))
  const { data, isFetching } = useCollectionsReportQuery(range)
  const { download, busy } = useCsv()
  return (
    <>
      <RangeBar range={range} onChange={setRange}>
        <Button
          icon={<Download size={14} />}
          loading={busy}
          onClick={() => download('collections', range, `collections-${range.start}-to-${range.end}`)}
        >
          Download CSV
        </Button>
      </RangeBar>
      {data && (
        <Totals
          items={[
            { title: 'Collected', value: formatInr(data.total_amount_inr) },
            { title: 'Payments', value: data.total_payments },
            { title: 'Gold bought', value: formatGrams(data.total_grams) },
          ]}
        />
      )}
      <Table
        rowKey="date"
        loading={isFetching}
        dataSource={data?.days}
        pagination={{ pageSize: 31, hideOnSinglePage: true }}
        locale={{ emptyText: 'No payments in these dates' }}
        columns={[
          { title: 'Date', dataIndex: 'date', render: formatDate },
          { title: 'Payments', dataIndex: 'payments', align: 'right' },
          { title: 'Amount', dataIndex: 'amount_inr', align: 'right', render: formatInr },
          { title: 'Gold bought', dataIndex: 'grams', align: 'right', render: formatGrams },
        ]}
      />
    </>
  )
}

function Redemptions() {
  const [range, setRange] = useState(() => lastDays(30))
  const [by, setBy] = useState<'day' | 'store'>('day')
  const { data, isFetching } = useRedemptionsReportQuery({ ...range, group_by: by })
  const { download, busy } = useCsv()
  return (
    <>
      <RangeBar range={range} onChange={setRange}>
        <Segmented
          value={by}
          onChange={setBy}
          options={[
            { label: 'By day', value: 'day' },
            { label: 'By store', value: 'store' },
          ]}
        />
        <Button
          icon={<Download size={14} />}
          loading={busy}
          onClick={() =>
            download('redemptions', { ...range, group_by: by }, `redemptions-by-${by}-${range.start}-to-${range.end}`)
          }
        >
          Download CSV
        </Button>
      </RangeBar>
      {data && (
        <Totals
          items={[
            { title: 'Redemptions', value: data.total_redemptions },
            { title: 'Gold redeemed', value: formatGrams(data.total_grams) },
            { title: 'Paid by customers', value: formatInr(data.total_amount_paid_inr) },
          ]}
        />
      )}
      <Table
        rowKey="label"
        loading={isFetching}
        dataSource={data?.rows}
        pagination={{ pageSize: 31, hideOnSinglePage: true }}
        locale={{ emptyText: 'No redemptions in these dates' }}
        columns={[
          { title: by === 'day' ? 'Date' : 'Store', dataIndex: 'label', render: (v: string) => (by === 'day' ? formatDate(v) : v) },
          { title: 'Redemptions', dataIndex: 'redemptions', align: 'right' },
          { title: 'Gold', dataIndex: 'grams', align: 'right', render: formatGrams },
          { title: 'Paid by customers', dataIndex: 'amount_paid_inr', align: 'right', render: formatInr },
        ]}
      />
    </>
  )
}

function Holdings() {
  const { data, isFetching } = useHoldingsReportQuery()
  const { download, busy } = useCsv()
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-slate-500">
          Gold customers hold now, valued at today's rate
          {data?.rate_per_gram ? ` (${formatInr(data.rate_per_gram)} per gram, ${data.purity})` : ''}.
        </span>
        <Button icon={<Download size={14} />} loading={busy} onClick={() => download('holdings', {}, `gold-held-${dayjs().format(DAY)}`)}>
          Download CSV
        </Button>
      </div>
      {data && (
        <Totals
          items={[
            { title: 'Customers holding gold', value: data.total_customers },
            { title: 'Gold held', value: formatGrams(data.total_grams) },
            { title: 'Value now', value: formatInr(data.total_value_inr) },
          ]}
        />
      )}
      <Table<HoldingsReport['rows'][number]>
        rowKey="customer_id"
        loading={isFetching}
        dataSource={data?.rows}
        pagination={{ pageSize: 25, hideOnSinglePage: true }}
        locale={{ emptyText: 'No customer holds gold right now' }}
        scroll={{ x: 700 }}
        columns={[
          {
            title: 'Customer',
            render: (_, r) => <Link to={`/customers/${r.customer_id}`}>{r.name || r.phone}</Link>,
          },
          { title: 'Phone', dataIndex: 'phone' },
          { title: 'Gold', dataIndex: 'grams', align: 'right', render: formatGrams },
          { title: 'Value now', dataIndex: 'value_inr', align: 'right', render: formatInr },
          { title: 'Open lots', dataIndex: 'open_lots', align: 'right' },
          { title: 'Next expiry', dataIndex: 'next_expiry', render: formatDate },
        ]}
      />
      {data && data.total_customers > data.rows.length && (
        <p className="text-slate-500 mt-2">Showing the {data.rows.length} largest holdings.</p>
      )}
    </>
  )
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Money in, gold out and gold still held. Download any of them for Excel." />
      <Card>
        <Tabs
          items={[
            { key: 'collections', label: 'Collections', children: <Collections /> },
            { key: 'redemptions', label: 'Redemptions', children: <Redemptions /> },
            { key: 'holdings', label: 'Gold held', children: <Holdings /> },
          ]}
        />
      </Card>
    </>
  )
}
