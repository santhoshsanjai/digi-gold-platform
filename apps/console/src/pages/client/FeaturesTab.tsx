import { Button, Form } from 'antd'
import { toast } from 'sonner'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import type { Features, Tenant } from '../../api/types.ts'
import { useSaveFeaturesMutation } from '../../store/api/consoleApi.ts'

const FEATURES: { key: keyof Features; label: string; notes: string }[] = [
  {
    key: 'savings_scheme',
    label: 'Savings scheme',
    notes: 'Customers buy gold from ₹100 and redeem it in store.',
  },
  { key: 'autopay_plans', label: 'Monthly autopay plans', notes: 'Not built yet.' },
  { key: 'gifting', label: 'Gifting', notes: 'Not built yet.' },
  { key: 'referrals', label: 'Referrals', notes: 'Not built yet.' },
  {
    key: 'partner_digital_gold',
    label: 'Partner digital gold',
    notes: 'Gold held with a vaulting partner. Not built yet.',
  },
  {
    key: 'test_payments',
    label: 'Test payments',
    notes:
      'Payments use a practice checkout and no money moves. Switch off once the client’s Razorpay account is connected.',
  },
]

export function FeaturesTab({ tenant }: { tenant: Tenant }) {
  const [save, { isLoading }] = useSaveFeaturesMutation()

  const onFinish = async (body: Features) => {
    try {
      await save({ tenantId: tenant.id, body }).unwrap()
      toast.success('Features saved')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Card className="max-w-2xl">
      <Form<Features> layout="vertical" initialValues={tenant.features} onFinish={onFinish}>
        {FEATURES.map((f) => (
          <InputContainer key={f.key} type="switch" name={f.key} label={f.label} notes={f.notes} />
        ))}
        <Button type="primary" htmlType="submit" loading={isLoading}>
          Save features
        </Button>
      </Form>
    </Card>
  )
}
