import { Linking, Pressable, RefreshControl, View } from 'react-native'
import { router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { useMe } from '../../src/api/hooks'
import type { Me } from '../../src/api/types'
import { useAuth } from '../../src/auth/AuthProvider'
import { formatDate } from '../../src/format'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Button, Card, ErrorNote, Pill, Row, Screen, Spinner, Text } from '../../src/ui'
import { confirmAction } from '../../src/ui/confirm'
import { FadeIn, GoldCoinFace } from '../../src/ui/gold'

export default function Profile() {
  const me = useMe()
  if (!me.data) {
    return (
      <Screen>
        {me.isError ? <ErrorNote message="Could not load your profile. Pull down to try again." /> : <Spinner />}
      </Screen>
    )
  }
  return <ProfileView m={me.data} refreshing={me.isRefetching} onRefresh={() => void me.refetch()} />
}

function ProfileView({ m, refreshing, onRefresh }: { m: Me; refreshing: boolean; onRefresh: () => void }) {
  const { brand, name, colors } = useTheme()
  const { signOut } = useAuth()
  const initial = (m.name || m.email || name).trim().slice(0, 1).toUpperCase()

  const logOut = () =>
    confirmAction('Log out?', 'You will need your email and password to sign in again.', 'Log out', () => void signOut())

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <FadeIn style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <View accessibilityLabel="Profile picture" style={{ borderRadius: 40, shadowColor: '#a67c2e', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
          <GoldCoinFace size={80} initial={initial} />
        </View>
        <Text size="title" style={{ textAlign: 'center' }}>
          {m.name || 'Your profile'}
        </Text>
        {m.email ? <Text tone="muted">{m.email}</Text> : null}
        <View>
          <Pill label="Active account" tone="success" />
        </View>
      </FadeIn>

      <FadeIn delay={80}>
        <Card>
          <Text size="heading">Account</Text>
          <Row label="Mobile" value={`+91 ${m.phone.replace(/^\+?91/, '')}`} />
          <Row label="Email" value={m.email || 'Not added'} tone={m.email ? undefined : 'muted'} />
          <Row label="Member since" value={formatDate(m.member_since)} />
          <Row label="Customer ID" value={m.id.slice(0, 8).toUpperCase()} />
          <Row label="PAN" value={m.pan_provided ? 'Added' : 'Not added'} tone={m.pan_provided ? undefined : 'muted'} />
        </Card>
      </FadeIn>

      <FadeIn delay={160}>
        <Card style={{ paddingVertical: 4, gap: 0 }}>
          <ActionRow label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <ActionRow
            label={m.has_password ? 'Change password' : 'Set a password'}
            detail={m.has_password ? undefined : 'Sign in with your email'}
            onPress={() => router.push('/account-password')}
            last={m.pan_provided}
          />
          {!m.pan_provided && <ActionRow label="Add PAN" onPress={() => router.push('/pan')} last />}
        </Card>
      </FadeIn>

      {!!(brand.support_phone || brand.support_email) && (
        <FadeIn delay={240}>
          <Card>
            <Text size="heading">Need help with {name}?</Text>
            {brand.support_phone ? (
              <Button variant="secondary" label={`Call ${brand.support_phone}`} onPress={() => Linking.openURL(`tel:${brand.support_phone}`)} />
            ) : null}
            {brand.support_email ? (
              <Button variant="secondary" label={`Email ${brand.support_email}`} onPress={() => Linking.openURL(`mailto:${brand.support_email}`)} />
            ) : null}
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={300}>
        <Button variant="danger" label="Log out" onPress={logOut} />
        <Text size="small" tone="muted" style={{ textAlign: 'center', marginTop: 12, color: colors.muted }}>
          Logging out ends the session on this phone only.
        </Text>
      </FadeIn>
    </Screen>
  )
}

function ActionRow({ label, detail, onPress, last }: { label: string; detail?: string; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{label}</Text>
        {detail ? (
          <Text size="small" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 5l7 7-7 7" />
      </Svg>
    </Pressable>
  )
}
