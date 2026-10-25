import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { ApiError } from '../src/api/client'
import { useMe, useRedemptionCode } from '../src/api/hooks'
import { TENANT_SLUG } from '../src/config'
import { formatGrams } from '../src/format'
import { useTheme } from '../src/theme/ThemeProvider'
import { clock, useCountdown } from '../src/useCountdown'
import { Button, Card, ErrorNote, Row, Screen, Spinner, Text } from '../src/ui'
import { QrCode } from '../src/ui/QrCode'

export default function Redeem() {
  const { colors } = useTheme()
  const me = useMe()
  const issue = useRedemptionCode()
  const asked = useRef(false)
  const code = issue.data
  const left = useCountdown(code?.expires_at)

  useEffect(() => {
    // One code per visit; "Get a new code" asks again.
    if (!asked.current) {
      asked.current = true
      issue.mutate()
    }
  }, [issue])

  const phone = (me.data?.phone ?? '').replace(/^\+?91/, '')

  return (
    <Screen padTop={false}>
      {issue.isPending && <Spinner />}
      {issue.error && <ErrorNote message={issue.error instanceof ApiError ? issue.error.message : 'Could not get a code.'} />}
      {code && (
        <>
          <Text tone="muted">
            Show this to the staff at the store. They will redeem all {formatGrams(code.grams)} for you.
          </Text>
          <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 24 }}>
            <Text size="small" tone="muted">
              Redemption code
            </Text>
            <Text size="big" accessibilityLabel={`Code ${code.code.split('').join(' ')}`} style={{ letterSpacing: 6 }}>
              {code.code.slice(0, 3)} {code.code.slice(3)}
            </Text>
            <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
              <QrCode value={`${TENANT_SLUG}:${phone}:${code.code}`} size={176} />
            </View>
            <Text tone={left > 0 ? 'muted' : 'danger'}>{left > 0 ? `Expires in ${clock(left)}` : 'This code has expired'}</Text>
          </Card>
          <Card>
            <Row icon="phone" label="Mobile number" value={`+91 ${phone}`} />
            <Row icon="coins" label="Gold to redeem" value={formatGrams(code.grams)} />
            <Text size="small" tone="muted">
              Give the staff your mobile number and this code. Once redeemed, the whole balance is closed.
            </Text>
          </Card>
          <Button variant="secondary" label="Get a new code" onPress={() => issue.mutate()} loading={issue.isPending} />
        </>
      )}
    </Screen>
  )
}
