import { Alert, Button, Skeleton } from 'antd'
import { Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader.tsx'
import { BrandMark } from '../components/common/BrandMark.tsx'
import { Card } from '../components/ui/Card.tsx'
import { useRedemptionSlipQuery } from '../store/api/goldApi.ts'
import { errorMessage } from '../utils/errors.ts'
import { formatDateTime, formatGrams, formatInr, formatPct } from '../utils/format.ts'

/** A printable slip the customer takes to the counter; the jeweller bills from it. */
export default function RedemptionSlipPage() {
  const { redemptionId = '' } = useParams()
  const { data, isLoading, error } = useRedemptionSlipQuery(redemptionId)

  if (error) return <Alert type="error" showIcon title={errorMessage(error)} />
  if (isLoading || !data) return <Skeleton active />
  const r = data.redemption

  const rows: [string, string][] = [
    ['Slip number', r.slip_number],
    ['Date', formatDateTime(r.created_at)],
    ['Customer', `${data.customer_name || '—'} (${data.customer_phone})`],
    ['Gold redeemed', `${formatGrams(r.grams)} of ${r.purity}`],
    ['Lots closed', String(r.lots_count)],
    ['Customer paid in', formatInr(r.amount_paid_inr)],
    ['Making-charge discount', formatPct(r.making_charge_discount_pct)],
    ['Store', data.store_name || '—'],
    ['Redeemed by', data.staff_name || '—'],
  ]

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`Slip ${r.slip_number}`}
          description={<Link to="/redemptions">← All redemptions</Link>}
          actions={
            <Button type="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
              Print
            </Button>
          }
        />
      </div>
      <Card className="max-w-xl mx-auto print:shadow-none print:border-0">
        <div className="flex items-center gap-3 mb-4">
          <BrandMark size={40} />
          <div>
            <div className="font-heading font-bold text-lg">{data.jeweller_name}</div>
            <div className="text-xs text-slate-500">Gold savings redemption slip</div>
          </div>
        </div>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="py-2 pr-4 text-slate-500 w-1/2">{k}</td>
                <td className="py-2 font-medium">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-8 mt-12 text-xs text-slate-500 text-center">
          <div className="border-t border-slate-300 pt-2">Customer signature</div>
          <div className="border-t border-slate-300 pt-2">Staff signature</div>
        </div>
      </Card>
    </>
  )
}
