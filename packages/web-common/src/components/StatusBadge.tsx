import { Badge } from './ui/Badge.tsx'

type Variant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

const VARIANTS: Record<string, [Variant, string]> = {
  paid: ['success', 'Paid'],
  pending: ['warning', 'Pending'],
  created: ['neutral', 'Started'],
  failed: ['danger', 'Failed'],
  open: ['primary', 'Open'],
  redeemed: ['success', 'Redeemed'],
  refunded: ['neutral', 'Refunded'],
  active: ['success', 'Active'],
  inactive: ['neutral', 'Inactive'],
  suspended: ['danger', 'Suspended'],
  published: ['success', 'Published'],
  draft: ['neutral', 'Draft'],
  changed: ['warning', 'Unpublished changes'],
}

/** A coloured label for payment, lot, account and page states. */
export const StatusBadge = ({ status }: { status: string }) => {
  const [variant, label] = VARIANTS[status] ?? ['neutral', status]
  return <Badge variant={variant}>{label}</Badge>
}
