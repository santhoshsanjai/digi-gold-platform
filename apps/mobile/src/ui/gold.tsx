/**
 * The look of the welcome, sign-in, sign-up and password screens: warm black, ivory text and
 * one gold accent. Built on React Native's Animated (native driver) and react-native-svg,
 * both already in the app, so no animation library is added.
 */
import { forwardRef, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg'
import { passwordStrength, STRENGTH_LABEL } from '../auth/validation'

export const gold = {
  bg: '#0d0b08',
  surface: '#16130e',
  field: '#1b1711',
  line: '#2f291e',
  lineFocus: '#c9a24b',
  text: '#f4eee2',
  muted: '#a39883',
  faint: '#6f6656',
  accent: '#d9b45a',
  light: '#f3dc93',
  deep: '#9a7126',
  onAccent: '#1c1407',
  danger: '#f19a90',
  dangerSoft: '#2c1714',
  success: '#9bd3a8',
  successSoft: '#13241a',
  warning: '#e9c46a',
  warningSoft: '#2a2312',
} as const

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' })

/** True when the phone asks for less motion; animations then show their end state. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduced(v))
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      live = false
      sub.remove()
    }
  }, [])
  return reduced
}

const native = Platform.OS !== 'web'
/** SVG ids must be plain names; React's useId adds colons. */
const useSvgId = (prefix: string) => prefix + useId().replace(/[^a-zA-Z0-9]/g, '')

/** Fades and lifts its children in once, after `delay` ms. */
export function FadeIn({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const [v] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: reduced ? 0 : 420, delay: reduced ? 0 : delay, easing: Easing.out(Easing.cubic), useNativeDriver: native })
    a.start()
    return () => a.stop()
  }, [v, delay, reduced])
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/** A few slow gold motes rising through the background. */
export function GoldParticles({ count = 12 }: { count?: number }) {
  const { width, height } = useWindowDimensions()
  const reduced = useReducedMotion()
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: ((i * 0.618034) % 1) * width,
        size: 2 + ((i * 7) % 3),
        duration: 9000 + ((i * 1373) % 6000),
        offset: (i * 0.37) % 1,
        value: new Animated.Value(0),
      })),
    [count, width],
  )
  useEffect(() => {
    if (reduced) return
    let live = true
    motes.forEach((m) => {
      // Start each mote part-way up, so the screen is not empty at first, then loop.
      m.value.setValue(m.offset)
      Animated.timing(m.value, { toValue: 1, duration: m.duration * (1 - m.offset), easing: Easing.linear, useNativeDriver: native }).start(({ finished }) => {
        if (!finished || !live) return
        m.value.setValue(0)
        Animated.loop(Animated.timing(m.value, { toValue: 1, duration: m.duration, easing: Easing.linear, useNativeDriver: native })).start()
      })
    })
    return () => {
      live = false
      motes.forEach((m) => m.value.stopAnimation())
    }
  }, [motes, reduced])
  if (reduced) return null
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {motes.map((m, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: m.x,
            top: 0,
            width: m.size,
            height: m.size,
            borderRadius: m.size,
            backgroundColor: gold.light,
            opacity: m.value.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.55, 0.3, 0] }),
            transform: [{ translateY: m.value.interpolate({ inputRange: [0, 1], outputRange: [height * 0.95, height * 0.15] }) }],
          }}
        />
      ))}
    </View>
  )
}

/** The page background: warm black with a faint gold glow behind the content. */
export function GoldBackdrop({ glowY = 0.32, particles = false }: { glowY?: number; particles?: boolean }) {
  const id = useSvgId('glow')
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: gold.bg }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy={`${glowY * 100}%`} rx="75%" ry="45%">
            <Stop offset="0" stopColor="#8a6421" stopOpacity="0.32" />
            <Stop offset="0.55" stopColor="#3a2a10" stopOpacity="0.12" />
            <Stop offset="1" stopColor={gold.bg} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {particles && <GoldParticles />}
    </View>
  )
}

/** A struck gold coin with the jeweller's initial, drawn in SVG so it is sharp at any size. */
export function GoldCoinFace({ size, initial }: { size: number; initial: string }) {
  const face = useSvgId('face')
  const rim = useSvgId('rim')
  const shine = useSvgId('shine')
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fbeab0" />
          <Stop offset="0.45" stopColor="#c99a3e" />
          <Stop offset="1" stopColor="#6e4c14" />
        </LinearGradient>
        <LinearGradient id={face} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <Stop offset="0" stopColor="#f6dd8f" />
          <Stop offset="0.4" stopColor="#ddb459" />
          <Stop offset="0.75" stopColor="#b5862e" />
          <Stop offset="1" stopColor="#8d661f" />
        </LinearGradient>
        <RadialGradient id={shine} cx="35%" cy="28%" r="55%">
          <Stop offset="0" stopColor="#fff6d6" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="100" cy="100" r="99" fill={`url(#${rim})`} />
      <Circle cx="100" cy="100" r="88" fill={`url(#${face})`} />
      <Circle cx="100" cy="100" r="80" fill="none" stroke="#7a5418" strokeOpacity="0.45" strokeWidth="1.2" />
      <Circle cx="100" cy="100" r="84" fill="none" stroke="#fff3c4" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="0.5 5" strokeLinecap="round" />
      <Circle cx="100" cy="100" r="88" fill={`url(#${shine})`} />
      <SvgText x="100" y="101" fill="#fff1c2" fillOpacity="0.45" fontSize="78" fontWeight="700" fontFamily={serif} textAnchor="middle" alignmentBaseline="central">
        {initial}
      </SvgText>
      <SvgText x="101" y="103" fill="#6f4c15" fillOpacity="0.85" fontSize="78" fontWeight="700" fontFamily={serif} textAnchor="middle" alignmentBaseline="central">
        {initial}
      </SvgText>
    </Svg>
  )
}

/** A light band that sweeps across a round shape; `progress` runs 0 to 1. */
export function Sheen({ size, progress }: { size: number; progress: Animated.Value }) {
  const id = useSvgId('sheen')
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <Animated.View
        style={{
          width: size * 0.5,
          height: size * 1.6,
          top: -size * 0.3,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.6, size * 1.1] }) },
            { rotate: '20deg' },
          ],
        }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.42" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
    </View>
  )
}

/** The screens' shared frame: background, safe areas, keyboard avoidance and a back button. */
export function AuthScreen({
  title,
  subtitle,
  children,
  back = true,
  onBack,
}: {
  title?: string
  subtitle?: ReactNode
  children: ReactNode
  back?: boolean
  onBack?: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: gold.bg }}>
      <StatusBar style="light" />
      <GoldBackdrop glowY={0.05} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 24,
            width: '100%',
            maxWidth: 480,
            alignSelf: 'center',
            gap: 20,
          }}
        >
          <View style={{ height: 44, justifyContent: 'center' }}>
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={12}
                onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/welcome')))}
                style={({ pressed }) => ({ width: 44, height: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={gold.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M15 5l-7 7 7 7" />
                </Svg>
              </Pressable>
            )}
          </View>
          {(title || subtitle) && (
            <FadeIn style={{ gap: 8 }}>
              {title ? (
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
              ) : null}
              {typeof subtitle === 'string' ? <Text style={styles.subtitle}>{subtitle}</Text> : subtitle}
            </FadeIn>
          )}
          <FadeIn delay={80} style={{ gap: 16, flexGrow: 1 }}>
            {children}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

interface AuthFieldProps extends TextInputProps {
  label: string
  error?: string | null
  hint?: string
  prefix?: string
  /** Adds a Show / Hide control and hides the text by default. */
  password?: boolean
}

/** A labelled input whose border warms to gold on focus. */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, hint, prefix, password, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [hidden, setHidden] = useState(true)
  const [focus] = useState(() => new Animated.Value(0))
  const to = (v: number) => Animated.timing(focus, { toValue: v, duration: 160, useNativeDriver: false }).start()
  const borderColor = error
    ? gold.danger
    : focus.interpolate({ inputRange: [0, 1], outputRange: [gold.line, gold.lineFocus] })
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.fieldBox, { borderColor }]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={gold.faint}
          selectionColor={gold.accent}
          cursorColor={gold.accent}
          secureTextEntry={password ? hidden : undefined}
          autoCapitalize={password ? 'none' : rest.autoCapitalize}
          autoCorrect={password ? false : rest.autoCorrect}
          onFocus={(e) => {
            to(1)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            to(0)
            onBlur?.(e)
          }}
          {...rest}
          style={[styles.input, style]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
            style={{ paddingLeft: 12, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: gold.accent, fontSize: 14, fontWeight: '600' }}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}
      </Animated.View>
      {error ? (
        <Text style={[styles.small, { color: gold.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.small, { color: gold.muted }]}>{hint}</Text>
      ) : null}
    </View>
  )
})

/** Four segments that fill as a new password gets stronger. */
export function StrengthMeter({ password }: { password: string }) {
  const score = passwordStrength(password)
  if (!password) return null
  const color = score <= 1 ? gold.danger : score === 2 ? gold.warning : gold.success
  return (
    <View style={{ gap: 6, marginTop: -6 }} accessibilityLabel={`Password strength: ${STRENGTH_LABEL[score]}`}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= score ? color : gold.line }} />
        ))}
      </View>
      <Text style={[styles.small, { color: gold.muted }]}>{STRENGTH_LABEL[score]}</Text>
    </View>
  )
}

export function GoldButton({
  label,
  onPress,
  variant = 'gold',
  loading,
  disabled,
  style,
}: {
  label: string
  onPress: () => void
  variant?: 'gold' | 'outline' | 'ghost'
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const id = useSvgId('btn')
  const off = !!(disabled || loading)
  const fg = variant === 'gold' ? gold.onAccent : variant === 'outline' ? gold.text : gold.accent
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        {
          minHeight: variant === 'ghost' ? 44 : 54,
          borderRadius: 14,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
          paddingHorizontal: 20,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: '#4a3f2b',
          opacity: off && !loading ? 0.45 : 1,
          transform: [{ scale: pressed && !off ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {variant === 'gold' && (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#f1d68a" />
              <Stop offset="0.5" stopColor="#d6ad52" />
              <Stop offset="1" stopColor="#b88a33" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      )}
      {loading && <ActivityIndicator color={fg} />}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600', letterSpacing: 0.2 }}>{label}</Text>
    </Pressable>
  )
}

/** A short status message: success, warning or error. */
export function Banner({ tone, text }: { tone: 'success' | 'warning' | 'danger'; text: string | null | undefined }) {
  if (!text) return null
  const fg = gold[tone]
  const bg = gold[`${tone}Soft` as const]
  return (
    <FadeIn>
      <View accessibilityLiveRegion="polite" style={{ backgroundColor: bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 3, borderLeftColor: fg }}>
        <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
      </View>
    </FadeIn>
  )
}

/** An inline text action, such as "Forgot password?". */
export function TextLink({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<TextStyle> }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={{ minHeight: 44, justifyContent: 'center' }}>
      {({ pressed }) => <Text style={[{ color: gold.accent, fontSize: 15, fontWeight: '600', opacity: pressed ? 0.6 : 1 }, style]}>{label}</Text>}
    </Pressable>
  )
}

/** "Prompt  Action" on one centred line, for switching between sign-in and sign-up. */
export function SwitchLine({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text style={{ color: gold.muted, fontSize: 15 }}>{prompt}</Text>
      <TextLink label={action} onPress={onPress} />
    </View>
  )
}

/** A gold tick that draws in, for "done" states. */
export function SuccessMark({ size = 72 }: { size?: number }) {
  const reduced = useReducedMotion()
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0))
  useEffect(() => {
    if (reduced) return v.setValue(1)
    Animated.spring(v, { toValue: 1, friction: 6, tension: 80, useNativeDriver: native }).start()
  }, [v, reduced])
  return (
    <Animated.View style={{ alignSelf: 'flex-start', opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Circle cx="36" cy="36" r="34" fill="#21190b" stroke={gold.accent} strokeWidth="1.5" />
        <Path d="M23 37l9 9 17-19" fill="none" stroke={gold.light} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  )
}

export const styles = StyleSheet.create({
  title: { color: gold.text, fontFamily: serif, fontSize: 28, lineHeight: 34, fontWeight: '600' },
  subtitle: { color: gold.muted, fontSize: 15, lineHeight: 22 },
  label: { color: gold.muted, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  small: { fontSize: 13, lineHeight: 18 },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: gold.field,
    paddingHorizontal: 16,
  },
  prefix: { color: gold.muted, fontSize: 17, marginRight: 8 },
  // The gold border shows focus, so the browser's own outline is hidden in the web preview.
  input: { flex: 1, minHeight: 54, fontSize: 17, color: gold.text, ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null) },
})
