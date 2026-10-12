import { useState } from 'react'
import { Input, Table } from 'antd'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Badge } from '../components/ui/Badge.tsx'
import { useCustomersQuery } from '../store/api/goldApi.ts'
import type { Customer } from '../api/types.ts'
import { useDebounced } from '../hooks/useDebounced.ts'
import { usePagination } from '../hooks/usePagination.ts'
import { formatDate, formatGrams, formatInr } from '../utils/format.ts'

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const { params, pagination, reset } = usePagination()
  const { data, isFetching } = useCustomersQuery({ ...params, q: q || undefined })

  const columns = [
    {
      title: 'Customer',
      key: 'name',
      render: (_: unknown, c: Customer) => (
        <Link to={`/customers/${c.id}`} className="font-medium">
          {c.name || 'No name yet'}
          <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">{c.phone}</div>
        </Link>
      ),
    },
    {
      title: 'Gold balance',
      dataIndex: 'gold_grams',
      align: 'right' as const,
      render: formatGrams,
    },
    {
      title: 'Total paid',
      dataIndex: 'total_paid_inr',
      align: 'right' as const,
      render: formatInr,
    },
    {
      title: 'PAN',
      key: 'pan',
      render: (_: unknown, c: Customer) =>
        c.pan ? (
          <Badge variant={c.pan_verified ? 'success' : 'warning'}>
            {c.pan_verified ? 'Verified' : 'Not verified'}
          </Badge>
        ) : (
          <Badge variant="neutral">Not given</Badge>
        ),
    },
    { title: 'Joined', dataIndex: 'created_at', render: formatDate },
  ]

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has signed in to the app." />
      <Card className="p-0!">
        <div className="p-4">
          <Input
            allowClear
            prefix={<Search size={16} className="text-slate-400" />}
            placeholder="Search by name, phone or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              reset()
            }}
            className="max-w-sm"
          />
        </div>
        <Table<Customer>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={pagination(data?.total)}
          scroll={{ x: 700 }}
        />
      </Card>
    </>
  )
}
