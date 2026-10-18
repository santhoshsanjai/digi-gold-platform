import { Button, Form } from 'antd'
import { toast } from 'sonner'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import type { Branding, Tenant } from '../../api/types.ts'
import { ImageField } from '../../components/ImageField.tsx'
import { useSaveBrandingMutation } from '../../store/api/consoleApi.ts'

const FONTS = ['Inter', 'Poppins', 'Lato', 'Montserrat', 'Jost', 'Playfair Display', 'Noto Sans', 'Mukta']
  .map((f) => ({ label: f, value: f }))
const HEADING_FONTS = [
  { label: 'Same as the main font', value: '' },
  ...['Cormorant Garamond', 'Playfair Display', 'Marcellus', 'Cinzel', 'Lora'].map((f) => ({ label: f, value: f })),
]

export function BrandingTab({ tenant }: { tenant: Tenant }) {
  const [form] = Form.useForm<Branding>()
  const [save, { isLoading }] = useSaveBrandingMutation()
  const live = Form.useWatch([], form) ?? tenant.branding

  const onFinish = async (body: Branding) => {
    try {
      await save({ tenantId: tenant.id, body }).unwrap()
      toast.success('Branding saved. The app, CRM and website pick it up straight away.')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <Form<Branding>
          form={form}
          layout="vertical"
          initialValues={tenant.branding}
          onFinish={onFinish}
          requiredMark={false}
        >
          <InputContainer
            type="input"
            name="display_name"
            label="Display name"
            placeholder={tenant.name}
            notes="Shown in the app and on the website. Leave empty to use the business name."
          />
          <Form.Item name="logo_url" label="Logo">
            <ImageField tenantId={tenant.id} />
          </Form.Item>
          <Form.Item name="favicon_url" label="Browser icon">
            <ImageField tenantId={tenant.id} />
          </Form.Item>
          <div className="grid gap-x-4 sm:grid-cols-3">
            <InputContainer type="color" name="primary_color" label="Main colour" />
            <InputContainer type="color" name="secondary_color" label="Second colour" />
            <InputContainer type="color" name="background_color" label="Background" />
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <InputContainer type="select" name="font_family" label="Font" options={FONTS} />
            <InputContainer
              type="select"
              name="heading_font_family"
              label="Website heading font"
              options={HEADING_FONTS}
            />
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <InputContainer type="email" name="support_email" label="Support email" />
            <InputContainer type="input" name="support_phone" label="Support phone" />
          </div>
          <Button type="primary" htmlType="submit" loading={isLoading}>
            Save branding
          </Button>
        </Form>
      </Card>
      <BrandPreview branding={{ ...tenant.branding, ...live }} name={tenant.name} />
    </div>
  )
}

function BrandPreview({ branding, name }: { branding: Branding; name: string }) {
  const title = branding.display_name || name
  return (
    <Card className="self-start">
      <p className="mt-0 mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Preview</p>
      <div
        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ background: branding.background_color, fontFamily: branding.font_family }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 text-white"
          style={{ background: branding.secondary_color }}
        >
          {branding.logo_url && (
            <img src={branding.logo_url} alt="" className="h-7 w-7 object-contain rounded bg-white" />
          )}
          <span className="font-semibold truncate">{title}</span>
        </div>
        <div className="p-4" style={{ color: branding.secondary_color }}>
          <p className="m-0 text-xs opacity-70">Today's 22K rate</p>
          <p className="m-0 text-2xl font-bold">₹ 7,250 / g</p>
          <button
            type="button"
            className="mt-4 w-full rounded-lg py-2 font-semibold text-white border-0"
            style={{ background: branding.primary_color }}
          >
            Buy gold
          </button>
        </div>
      </div>
    </Card>
  )
}
