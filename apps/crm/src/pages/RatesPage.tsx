import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Segmented, Skeleton, Table } from 'antd'
import { toast } from 'sonner'
import { PageHeader } from '../components/common/PageHeader.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Badge } from '../components/ui/Badge.tsx'
import InputContainer from '../shared-components/InputContainer.tsx'
import { useAuth } from '../providers/authContext.ts'
import {
  useCurrentRatesQuery,
  usePublishRateMutation,
  useRateHistoryQuery,
  useSetBuyingPausedMutation,
} from '../store/api/goldApi.ts'
import type { GoldRate, Purity } from '../api/types.ts'
import { usePagination } from '../hooks/usePagination.ts'
import { errorBody, errorMessage, errorStatus } from '../utils/errors.ts'
import { formatDateTime, formatInr, formatPct } from '../utils/format.ts'

const PURITIES: Purity[] = ['22K', '24K']

interface RateForm {
  purity: Purity
  rate_per_gram: number
}

export default function RatesPage() {
  const { can } = useAuth()
  const { data: current, isLoading } = useCurrentRatesQuery(undefined, { pollingInterval: 60_000 })
  const [historyPurity, setHistoryPurity] = useState<Purity | 'all'>('all')
  const { params, pagination } = usePagination()
  const history = useRateHistoryQuery({
    ...params,
    purity: historyPurity === 'all' ? undefined : historyPurity,
  })
  const [publish, { isLoading: publishing }] = usePublishRateMutation()
  const [setPaused, { isLoading: pausing }] = useSetBuyingPausedMutation()
  const [form] = Form.useForm<RateForm>()
  // useModal (not Modal.confirm) so the dialog follows the client's theme.
  const [modal, modalContext] = Modal.useModal()
  const [pauseReason, setPauseReason] = useState('')
  const [pauseOpen, setPauseOpen] = useState(false)

  const submit = async (values: RateForm, confirm = false) => {
    try {
      await publish({ ...values, confirm_large_change: confirm }).unwrap()
      toast.success(`${values.purity} rate published: ${formatInr(values.rate_per_gram)}/g`)
      form.resetFields(['rate_per_gram'])
    } catch (e) {
      const body = errorBody(e)
      // A big jump from the last rate is usually a typo, so the API asks to confirm it.
      if (errorStatus(e) === 409 && body?.code === 'confirm_large_change') {
        modal.confirm({
          title: 'Publish this rate?',
          content: (
            <p>
              {formatInr(values.rate_per_gram)}/g is {formatPct(String(body.change_pct))} from the
              previous rate of {formatInr(String(body.previous_rate))}/g. Check the figure before
              publishing.
            </p>
          ),
          okText: 'Yes, publish',
          onOk: () => submit(values, true),
        })
        return
      }
      toast.error(errorMessage(e))
    }
  }

  const togglePause = async (paused: boolean) => {
    try {
      await setPaused({ paused, reason: pauseReason || undefined }).unwrap()
      toast.success(paused ? 'Buying paused for customers' : 'Buying reopened for customers')
      setPauseOpen(false)
      setPauseReason('')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const columns = [
    { title: 'Published', dataIndex: 'created_at', render: formatDateTime },
    { title: 'Purity', dataIndex: 'purity' },
    {
      title: 'Rate per gram',
      dataIndex: 'rate_per_gram',
      align: 'right' as const,
      render: formatInr,
    },
    {
      title: 'Change',
      dataIndex: 'change_pct',
      align: 'right' as const,
      render: (v: string | null, r: GoldRate) => (
        <span className={r.large_change_confirmed ? 'text-amber-600 font-medium' : ''}>
          {v === null ? '—' : formatPct(v)}
        </span>
      ),
    },
  ]

  return (
    <>
      {modalContext}
      <PageHeader
        title="Gold rate"
        description="Customers buy at the latest published rate for the scheme purity."
        actions={
          can('rates:edit') &&
          current &&
          (current.buying_paused ? (
            <Button type="primary" loading={pausing} onClick={() => togglePause(false)}>
              Reopen buying
            </Button>
          ) : (
            <Button danger onClick={() => setPauseOpen(true)}>
              Pause buying
            </Button>
          ))
        }
      />

      {isLoading || !current ? (
        <Skeleton active />
      ) : (
        <>
          {!current.buying_open && (
            <Alert
              className="mb-6"
              type="warning"
              showIcon
              title="Customers cannot buy gold right now"
              description={current.reason}
            />
          )}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {PURITIES.map((p) => {
              const rate = current.rates[p] as GoldRate | null | undefined
              return (
                <Card key={p}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{p} per gram</span>
                    {p === current.scheme_purity && <Badge>Scheme purity</Badge>}
                  </div>
                  <div className="text-3xl font-bold font-heading mt-2">
                    {rate ? formatInr(rate.rate_per_gram) : 'Not set'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {rate ? `Updated ${formatDateTime(rate.created_at)}` : 'No rate published yet'}
                  </div>
                </Card>
              )
            })}
            {can('rates:create') && (
              <Card>
                <Form<RateForm>
                  form={form}
                  layout="vertical"
                  initialValues={{ purity: current.scheme_purity as Purity }}
                  onFinish={(v) => submit(v)}
                  requiredMark={false}
                >
                  <InputContainer
                    type="radio"
                    name="purity"
                    label="Publish a new rate"
                    isToggleButton
                    options={PURITIES.map((p) => ({ label: p, value: p }))}
                  />
                  <InputContainer
                    type="number"
                    name="rate_per_gram"
                    required
                    label="Rate per gram"
                    prefix="₹"
                    min={1}
                    precision={2}
                    placeholder="e.g. 7250.00"
                  />
                  <Button type="primary" htmlType="submit" loading={publishing} block>
                    Publish rate
                  </Button>
                </Form>
              </Card>
            )}
          </div>
        </>
      )}

      <Card className="p-0!">
        <div className="flex items-center justify-between p-4">
          <h3 className="m-0 text-base font-semibold">History</h3>
          <Segmented
            value={historyPurity}
            onChange={(v) => setHistoryPurity(v as Purity | 'all')}
            options={[
              { label: 'All', value: 'all' },
              ...PURITIES.map((p) => ({ label: p, value: p })),
            ]}
          />
        </div>
        <Table<GoldRate>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={history.data?.items}
          loading={history.isFetching}
          pagination={pagination(history.data?.total)}
          scroll={{ x: 600 }}
        />
      </Card>

      <Modal
        title="Pause buying for all customers?"
        open={pauseOpen}
        okText="Pause buying"
        okButtonProps={{ danger: true, loading: pausing }}
        onOk={() => togglePause(true)}
        onCancel={() => setPauseOpen(false)}
      >
        <p>Customers will see the reason below in the app until you reopen buying.</p>
        <Input.TextArea
          rows={3}
          maxLength={200}
          value={pauseReason}
          onChange={(e) => setPauseReason(e.target.value)}
          placeholder="e.g. Rates are changing quickly; buying reopens shortly."
        />
      </Modal>
    </>
  )
}
