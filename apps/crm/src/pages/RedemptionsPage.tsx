import { useState } from 'react'
import { Button, Form, Modal, Result, Table } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { useAuth } from '../providers/authContext.ts'
import { useStoresQuery } from '../store/api/adminApi.ts'
import { useRedeemMutation, useRedemptionsQuery } from '../store/api/goldApi.ts'
import type { Redemption } from '../api/types.ts'
import { usePagination } from '@digigold/web-common/hooks/usePagination.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDateTime, formatGrams, formatInr, formatPct } from '@digigold/web-common/utils/format.ts'
import { indianPhoneRule } from '@digigold/web-common/utils/validation.ts'

interface RedeemForm {
  phone: string
  code: string
  store_id?: string
}

export default function RedemptionsPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const { params, pagination } = usePagination()
  const { data, isFetching } = useRedemptionsQuery(params)
  const stores = useStoresQuery(undefined, { skip: !can('stores:view') })
  const [redeem, { isLoading }] = useRedeemMutation()
  const [form] = Form.useForm<RedeemForm>()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<Redemption | null>(null)

  const activeStores = (stores.data ?? []).filter((s) => s.is_active)

  const onFinish = async (values: RedeemForm) => {
    try {
      const result = await redeem({
        phone: values.phone,
        code: values.code.trim(),
        store_id: values.store_id || null,
      }).unwrap()
      setDone(result)
      form.resetFields()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const close = () => {
    setOpen(false)
    setDone(null)
    form.resetFields()
  }

  const columns = [
    {
      title: 'Slip',
      dataIndex: 'slip_number',
      render: (s: string, r: Redemption) => <Link to={`/redemptions/${r.id}/slip`}>{s}</Link>,
    },
    { title: 'When', dataIndex: 'created_at', render: formatDateTime },
    {
      title: 'Customer',
      dataIndex: 'customer_id',
      render: (id: string) => <Link to={`/customers/${id}`}>View customer</Link>,
    },
    { title: 'Grams', dataIndex: 'grams', align: 'right' as const, render: formatGrams },
    { title: 'Purity', dataIndex: 'purity' },
    {
      title: 'Customer paid in',
      dataIndex: 'amount_paid_inr',
      align: 'right' as const,
      render: formatInr,
    },
    {
      title: 'Making-charge discount',
      dataIndex: 'making_charge_discount_pct',
      align: 'right' as const,
      render: formatPct,
    },
  ]

  return (
    <>
      <PageHeader
        title="Redemptions"
        description="Customers redeem their whole gold balance in store with a code from the app."
        actions={
          can('redemptions:create') && (
            <Button type="primary" onClick={() => setOpen(true)}>
              Redeem for a customer
            </Button>
          )
        }
      />
      <Card className="p-0!">
        <Table<Redemption>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={pagination(data?.total)}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={done ? null : 'Redeem gold balance'}
        open={open}
        onCancel={close}
        footer={null}
        destroyOnHidden
      >
        {done ? (
          <Result
            status="success"
            title={`${formatGrams(done.grams)} redeemed`}
            subTitle={`Slip ${done.slip_number}. Making-charge discount: ${formatPct(done.making_charge_discount_pct)}.`}
            extra={[
              <Button
                key="slip"
                type="primary"
                onClick={() => navigate(`/redemptions/${done.id}/slip`)}
              >
                Print slip
              </Button>,
              <Button key="close" onClick={close}>
                Done
              </Button>,
            ]}
          />
        ) : (
          <Form<RedeemForm> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0">
              Ask the customer to open the app and tap Redeem. They read out the code shown on
              their screen.
            </p>
            <InputContainer
              type="input"
              name="phone"
              label="Customer's mobile number"
              required
              rules={[indianPhoneRule]}
              autoFocus
              placeholder="10-digit mobile number"
            />
            <InputContainer
              type="input"
              name="code"
              label="Redemption code"
              required
              rules={[{ pattern: /^\d{6}$/, message: 'Enter the 6-digit code shown in the app' }]}
              placeholder="Code from the app"
            />
            {activeStores.length > 0 && (
              <InputContainer
                type="select"
                name="store_id"
                label="Store"
                options={activeStores.map((s) => ({ label: s.name, value: s.id }))}
                notes="Staff linked to a store always redeem for their own store."
              />
            )}
            <Button type="primary" htmlType="submit" loading={isLoading} block>
              Redeem full balance
            </Button>
          </Form>
        )}
      </Modal>
    </>
  )
}
