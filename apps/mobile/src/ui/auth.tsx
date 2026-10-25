/**
 * The frame of the sign-in, sign-up and password screens. They use the app's own colours
 * and components (Field, Button), so the forms look the same before and after signing in.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Platform, Pressable, View, type StyleProp, type TextStyle } from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { passwordStrength, STRENGTH_LABEL } from '../auth/validation'
import { useTheme } from '../theme/ThemeProvider'
import { Text } from './index'
import { FadeIn, useReducedMotion } from './gold'
import { KeyboardScroll, useKeyboardHeight } from './keyboard'

export function AuthScreen({
  title,
  subtitle,
  children,
  back = true,
  onBack,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  back?: boolean
  onBack?: () => void
}) {
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardHeight()
  const { colors, dark } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <KeyboardScroll
        keyboard={keyboard}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 4,
          paddingBottom: insets.bottom + 20,
          width: '100%',
          maxWidth: 480,
          alignSelf: 'center',
        }}
      >
        <View style={{ height: 48, justifyContent: 'center', marginLeft: -8 }}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/welcome')))}
              style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M15 5l-7 7 7 7" />
              </Svg>
            </Pressable>
          )}
        </View>
        <View style={{ gap: 6, marginTop: 12, marginBottom: 28 }}>
          <Text size="title" accessibilityRole="header">
            {title}
          </Text>
          {typeof subtitle === 'string' ? <Text tone="muted">{subtitle}</Text> : subtitle}
        </View>
        <FadeIn style={{ gap: 18, flexGrow: 1 }}>{children}</FadeIn>
      </KeyboardScroll>
    </View>
  )
}

/** An inline text action, such as "Forgot password?". */
export function TextLink({ label, onPress, style, disabled }: { label: string; onPress: () => void; style?: StyleProp<TextStyle>; disabled?: boolean }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      {({ pressed }) => (
        <Text style={[{ color: disabled ? colors.muted : colors.primary, fontSize: 15, fontWeight: '600', opacity: pressed ? 0.6 : 1 }, style]}>{label}</Text>
      )}
    </Pressable>
  )
}

/** "Prompt  Action" on one centred line, for switching between sign-in and sign-up. */
export function SwitchLine({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <Text tone="muted" style={{ fontSize: 15 }}>
        {prompt}
      </Text>
      <TextLink label={action} onPress={onPress} />
    </View>
  )
}

/** A check mark in a circle that scales in, for "done" screens. */
export function SuccessMark({ size = 64 }: { size?: number }) {
  const { colors } = useTheme()
  const reduced = useReducedMotion()
  const [v] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (reduced) return v.setValue(1)
    Animated.spring(v, { toValue: 1, friction: 7, tension: 90, useNativeDriver: Platform.OS !== 'web' }).start()
  }, [v, reduced])
  return (
    <Animated.View style={{ alignSelf: 'center', opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle cx="32" cy="32" r="32" fill={colors.successSoft} />
        <Path d="M20 33l8 8 16-17" fill="none" stroke={colors.success} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  )
}

/** A thin bar under a new password showing how strong it is. */
export function StrengthMeter({ password }: { password: string }) {
  const { colors } = useTheme()
  const score = passwordStrength(password)
  if (!password) return null
  const color = score <= 1 ? colors.danger : score === 2 ? colors.warning : colors.success
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8 }} accessibilityLabel={`Password strength: ${STRENGTH_LABEL[score]}`}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= score ? color : colors.line }} />
        ))}
      </View>
      <Text size="small" style={{ color, minWidth: 64, textAlign: 'right' }}>
        {STRENGTH_LABEL[score]}
      </Text>
    </View>
  )
}
