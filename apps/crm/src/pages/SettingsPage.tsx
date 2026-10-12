import { useEffect } from 'react'
import { Alert, Button, Form, Skeleton, Table, Tabs } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { useAuth } from '../providers/authContext.ts'
import {
  useAuditLogQuery,
  useSaveSchemeSettingsMutation,
  useSchemeSettingsQuery,
} from '../store/api/adminApi.ts'
import type { AuditEntry, Purity, SchemeSettings, SchemeSettingsIn } from '../api/types.ts'
import { usePagination } from '@digigold/web-common/hooks/usePagination.ts'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDateTime } from '@digigold/web-common/utils/format.ts'

const MAX_VALIDITY_DAYS = 365

interface SettingsForm {
  purity: Purity
  min_payment_inr: number
  max_payment_inr: number
  pan_required_above_inr: number
  redemption_threshold_grams: number
  making_charge_discount_pct: number
  lot_validity_days: number
  settlement_hold_days: number
  price_lock_minutes: number
  daily_rate_deadline: Dayjs
  rate_change_confirm_pct: number
  reminder_days_before_expiry: string[]
  reminder_every_days_after_expiry: number
  manual_refund_enabled: boolean
}

// Amounts come as decimal strings and the deadline as "HH:MM:SS"; the form edits numbers.
const toForm = (s: SchemeSettings): SettingsForm => ({
  purity: s.purity ?? '22K',
  min_payment_inr: Number(s.min_payment_inr),
  max_payment_inr: Number(s.max_payment_inr),
  pan_required_above_inr: Number(s.pan_required_above_inr),
  redemption_threshold_grams: Number(s.redemption_threshold_grams),
  making_charge_discount_pct: Number(s.making_charge_discount_pct),
  lot_validity_days: s.lot_validity_days ?? MAX_VALIDITY_DAYS,
  settlement_hold_days: s.settlement_hold_days ?? 2,
  price_lock_minutes: s.price_lock_minutes ?? 5,
  daily_rate_deadline: dayjs(`2000-01-01T${s.daily_rate_deadline ?? '11:00:00'}`),
  rate_change_confirm_pct: Number(s.rate_change_confirm_pct),
  reminder_days_before_expiry: (s.reminder_days_before_expiry ?? []).map(String),
  reminder_every_days_after_expiry: s.reminder_every_days_after_expiry ?? 7,
  manual_refund_enabled: Boolean(s.manual_refund_enabled),
})

const fromForm = (f: SettingsForm): SchemeSettingsIn => ({
  ...f,
  daily_rate_deadline: f.daily_rate_deadline.format('HH:mm:00'),
  reminder_days_before_expiry: f.reminder_days_before_expiry.map(Number),
})

const reminderDaysRule = {
  validator: (_: unknown, value: string[] = []) => {
    if (value.length > 5) return Promise.reject(new Error('Up to 5 reminders'))
    if (value.some((v) => !/^\d+$/.test(v) || Number(v) < 1 || Number(v) > MAX_VALIDITY_DAYS)) {
      return Promise.reject(new Error('Each reminder is a number of days from 1 to 365'))
    }
    return Promise.resolve()
  },
}

function SchemeSettingsForm() {
  const { can } = useAuth()
  const { data, isLoading, error } = useSchemeSettingsQuery()
  const [save, { isLoading: saving }] = useSaveSchemeSettingsMutation()
  const [form] = Form.useForm<SettingsForm>()
  const readOnly = !can('settings:edit')

  useEffect(() => {
    if (data) form.setFieldsValue(toForm(data))
  }, [data, form])

  if (error) return <Alert type="error" showIcon title={errorMessage(error)} />
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 12 }} />

  const onFinish = async (values: SettingsForm) => {
    try {
      await save(fromForm(values)).unwrap()
      toast.success('Settings saved. They apply to new payments; earlier lots keep their terms.')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const section = (title: string, description: string, children: React.ReactNode) => (
    <Card className="mb-6">
      <h3 className="m-0 text-base font-semibold">{title}</h3>
      <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <div className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </Card>
  )

  return (
    <Form<SettingsForm>
      form={form}
      layout="vertical"
      onFinish={onFinish}
      disabled={readOnly}
      requiredMark={false}
    >
      {section(
        'Payments',
        'What customers can pay in the app.',
        <>
          <InputContainer
            type="radio"
            name="purity"
            label="Gold purity"
            isToggleButton
            options={[
              { label: '22K', value: '22K' },
              { label: '24K', value: '24K' },
            ]}
            notes="Customers buy at the rate published for this purity."
          />
          <InputContainer
            type="number"
            name="min_payment_inr"
            label="Minimum payment"
            prefix="₹"
            min={1}
            precision={2}
            required
          />
          <InputContainer
            type="number"
            name="max_payment_inr"
            label="Maximum payment"
            prefix="₹"
            min={1}
            precision={2}
            required
            dependencies={['min_payment_inr']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  v === undefined || v >= getFieldValue('min_payment_inr')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Must be at least the minimum payment')),
              }),
            ]}
          />
          <InputContainer
            type="number"
            name="pan_required_above_inr"
            label="Ask for PAN once total paid exceeds"
            prefix="₹"
            min={0}
            precision={2}
            required
          />
          <InputContainer
            type="number"
            name="price_lock_minutes"
            label="Price held during checkout"
            suffix="minutes"
            min={1}
            max={30}
            precision={0}
            required
          />
        </>,
      )}
      {section(
        'Gold rate',
        'Safeguards for the daily rate your staff publish.',
        <>
          <InputContainer
            type="time"
            name="daily_rate_deadline"
            label="Publish today's rate by"
            required
            notes="Buying pauses after this time until today's rate is published."
          />
          <InputContainer
            type="number"
            name="rate_change_confirm_pct"
            label="Ask to confirm a rate change above"
            suffix="%"
            min={0}
            max={100}
            precision={2}
            required
            notes="Catches typos such as an extra zero."
          />
        </>,
      )}
      {section(
        'Redemption',
        'When and how customers redeem their gold in store.',
        <>
          <InputContainer
            type="number"
            name="redemption_threshold_grams"
            label="Minimum balance to redeem"
            suffix="g"
            min={0.0001}
            precision={4}
            required
          />
          <InputContainer
            type="number"
            name="making_charge_discount_pct"
            label="Making-charge discount at redemption"
            suffix="%"
            min={0}
            max={100}
            precision={2}
            required
          />
          <InputContainer
            type="number"
            name="settlement_hold_days"
            label="Days before a payment can be redeemed"
            suffix="days"
            min={0}
            max={7}
            precision={0}
            required
            notes="Allows time for the payment to settle."
          />
        </>,
      )}
      {section(
        'Validity and reminders',
        'Advances must be used within 365 days. Customers get emails before and after expiry.',
        <>
          <InputContainer
            type="number"
            name="lot_validity_days"
            label="Each payment is valid for"
            suffix="days"
            min={1}
            max={MAX_VALIDITY_DAYS}
            precision={0}
            required
            notes="365 days at most."
          />
          <InputContainer
            type="tags"
            name="reminder_days_before_expiry"
            label="Remind this many days before expiry"
            rules={[reminderDaysRule]}
            placeholder="e.g. 60, 30, 7"
            notes="Type a number and press Enter. Up to 5."
          />
          <InputContainer
            type="number"
            name="reminder_every_days_after_expiry"
            label="After expiry, remind every"
            suffix="days"
            min={1}
            max={30}
            precision={0}
            required
          />
          <InputContainer
            type="switch"
            name="manual_refund_enabled"
            label="Allow recording refunds"
            notes="Lets staff close an expired lot after returning the money."
          />
        </>,
      )}
      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button onClick={() => form.setFieldsValue(toForm(data))}>Undo changes</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            Save settings
          </Button>
        </div>
      )}
    </Form>
  )
}

const ACTION_LABELS: Record<string, string> = {
  'settings.updated': 'Settings changed',
  'rate.published': 'Rate published',
  'buying.paused': 'Buying paused or reopened',
  'redemption.created': 'Gold redeemed',
  'lot.refunded': 'Refund recorded',
  'user.created': 'User added',
  'user.updated': 'User changed',
  'user.temp_password_issued': 'Temporary password sent',
  'user.password_set': 'Password set on first sign-in',
  'user.password_changed': 'Password changed',
  'user.password_reset': 'Password reset by email',
  'role.created': 'Role added',
  'role.updated': 'Role changed',
  'role.deleted': 'Role deleted',
  'store.created': 'Store added',
  'store.updated': 'Store changed',
  'tenant.branding_updated': 'Branding changed',
  'tenant.features_updated': 'Features changed',
  'tenant.updated': 'Account changed',
  'tenant.created': 'Account created',
}

function ActivityLog() {
  const { params, pagination } = usePagination()
  const { data, isFetching } = useAuditLogQuery(params)
  const columns = [
    { title: 'When', dataIndex: 'created_at', render: formatDateTime, width: 200 },
    {
      title: 'What',
      dataIndex: 'action',
      render: (a: string) => ACTION_LABELS[a] ?? a,
      width: 200,
    },
    {
      title: 'Details',
      dataIndex: 'changes',
      render: (changes: AuditEntry['changes']) => {
        const keys = Object.keys(changes ?? {})
        return keys.length ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">{keys.join(', ')}</span>
        ) : (
          '—'
        )
      },
    },
  ]
  return (
    <Card className="p-0!">
      <Table<AuditEntry>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={data?.items}
        loading={isFetching}
        pagination={pagination(data?.total)}
        scroll={{ x: 700 }}
      />
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Scheme limits and rules for your customers." />
      <Tabs
        items={[
          { key: 'scheme', label: 'Scheme', children: <SchemeSettingsForm /> },
          { key: 'activity', label: 'Activity log', children: <ActivityLog /> },
        ]}
      />
    </>
  )
}
