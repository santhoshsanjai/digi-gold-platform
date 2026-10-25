import { Linking, Pressable, RefreshControl, View } from 'react-native'
import { router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { useMe } from '../../src/api/hooks'
import type { Me } from '../../src/api/types'
import { useAuth } from '../../src/auth/AuthProvider'
import { formatDate, formatGrams, formatInr } from '../../src/format'
import { useTheme } from '../../src/theme/ThemeProvider'
import { Card, ErrorNote, List, ListItem, Pill, Screen, SectionTitle, Spinner, Text } from '../../src/ui'
import { IconBadge, type IconName } from '../../src/ui/Icon'
import { confirmAction } from '../../src/ui/confirm'
import { FadeIn } from '../../src/ui/gold'

/** First letters of the first and last name, e.g. "Meena Raman" -> "MR". */
function initials(name: string): string {
  const words = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

/** A round avatar with the customer's initials and a small edit button. */
function Avatar({ name, onEdit }: { name: string; onEdit: () => void }) {
  const { colors } = useTheme()
  const size = 88
  return (
    <View accessible accessibilityLabel={`Profile picture, ${initials(name)}`} style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primarySoft,
          borderWidth: 3,
          borderColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 32, lineHeight: 38, fontWeight: '600' }}>{initials(name)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        hitSlop={8}
        onPress={onEdit}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
        </Svg>
      </Pressable>
    </View>
  )
}

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
  const { brand, name } = useTheme()
  const { signOut } = useAuth()

  const logOut = () =>
    confirmAction('Log out?', 'You will need your email and password to sign in again.', 'Log out', () => void signOut())

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <FadeIn style={{ alignItems: 'center', gap: 4, paddingTop: 12, paddingBottom: 4 }}>
        <Avatar name={m.name || m.email || name} onEdit={() => router.push('/edit-profile')} />
        <Text size="title" style={{ textAlign: 'center', marginTop: 12 }}>
          {m.name || 'Your profile'}
        </Text>
        {m.email ? <Text tone="muted">{m.email}</Text> : null}
        <View style={{ marginTop: 8 }}>
          <Pill label="Active" tone="success" />
        </View>
      </FadeIn>

      <FadeIn delay={60} style={{ flexDirection: 'row', gap: 12 }}>
        <Stat icon="coins" label="Gold balance" value={formatGrams(m.gold_grams)} />
        <Stat icon="wallet" label="Total paid" value={formatInr(m.total_paid_inr)} />
      </FadeIn>

      <FadeIn delay={120} style={{ gap: 16 }}>
        <SectionTitle>Account information</SectionTitle>
        <List>
          <ListItem icon="phone" title="Mobile number" subtitle={`+91 ${m.phone.replace(/^\+?91/, '')}`} />
          <ListItem icon="mail" title="Email" subtitle={m.email || 'Not added'} />
          <ListItem icon="calendar" title="Member since" subtitle={formatDate(m.member_since)} />
          <ListItem icon="badge" title="Customer ID" subtitle={m.id.slice(0, 8).toUpperCase()} />
          <ListItem
            icon="card"
            title="PAN"
            subtitle={m.pan_provided ? 'Added' : 'Not added'}
            onPress={m.pan_provided ? undefined : () => router.push('/pan')}
            last
          />
        </List>

        <SectionTitle>Settings</SectionTitle>
        <List>
          <ListItem icon="user" title="Edit profile" subtitle="Name and email" onPress={() => router.push('/edit-profile')} />
          <ListItem
            icon="lock"
            title={m.has_password ? 'Change password' : 'Set a password'}
            subtitle={m.has_password ? 'Update your sign-in password' : 'Sign in with your email'}
            onPress={() => router.push('/account-password')}
            last
          />
        </List>

        {!!(brand.support_phone || brand.support_email) && (
          <>
            <SectionTitle>{`Help from ${name}`}</SectionTitle>
            <List>
              {brand.support_phone ? (
                <ListItem
                  icon="call"
                  title="Call the store"
                  subtitle={brand.support_phone}
                  onPress={() => Linking.openURL(`tel:${brand.support_phone}`)}
                  last={!brand.support_email}
                />
              ) : null}
              {brand.support_email ? (
                <ListItem
                  icon="help"
                  title="Email support"
                  subtitle={brand.support_email}
                  onPress={() => Linking.openURL(`mailto:${brand.support_email}`)}
                  last
                />
              ) : null}
            </List>
          </>
        )}

        <List>
          <ListItem icon="logout" title="Log out" subtitle="Ends the session on this phone only" onPress={logOut} destructive last />
        </List>
      </FadeIn>
    </Screen>
  )
}

/** A small figure with its icon, shown side by side under the avatar. */
function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 8 }}>
      <IconBadge name={icon} size={32} />
      <View>
        <Text size="small" tone="muted">
          {label}
        </Text>
        <Text size="heading" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </Card>
  )
}