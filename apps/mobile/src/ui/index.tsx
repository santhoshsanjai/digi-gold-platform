import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
  type RefreshControlProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { mix } from '../theme/colors'
import { useTheme } from '../theme/ThemeProvider'
import { KeyboardScroll, useKeyboardHeight, useRevealOnFocus } from './keyboard'

type Tone = 'normal' | 'muted' | 'success' | 'warning' | 'danger'
type Size = 'title' | 'heading' | 'body' | 'small' | 'big'

/** Serif for titles and amounts, the system face for everything else. */
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' })

const SIZES: Record<Size, TextStyle> = {
  big: { fontSize: 38, lineHeight: 44, fontWeight: '600', fontFamily: serif, fontVariant: ['tabular-nums'] },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '600', fontFamily: serif },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 13, lineHeight: 18 },
}

export function Text({
  size = 'body',
  tone = 'normal',
  style,
  ...rest
}: TextProps & { size?: Size; tone?: Tone }) {
  const { colors } = useTheme()
  const color = tone === 'normal' ? colors.text : tone === 'muted' ? colors.muted : colors[tone]
  return <RNText {...rest} style={[SIZES[size], { color }, style]} />
}

/** A small uppercase label above a section or figure. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme()
  return <RNText style={[{ color: colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1.6 }, style]}>{children}</RNText>
}

/** A scrolling page with the safe-area padding and a consistent gutter. Fields scroll above
 * the keyboard, and the footer (when there is one) rides on top of it. */
export function Screen({
  children,
  refresh,
  footer,
  padTop = true,
}: {
  children: ReactNode
  refresh?: React.ReactElement<RefreshControlProps>
  footer?: ReactNode
  padTop?: boolean
}) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardHeight()
  const [footerHeight, setFooterHeight] = useState(0)
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardScroll
        keyboard={keyboard}
        // With a footer, the footer itself moves up and the page above it shrinks.
        padForKeyboard={!footer}
        // The footer's measured height includes the keyboard padding below its buttons.
        covered={footer && keyboard > 0 ? Math.max(0, footerHeight - keyboard) : 0}
        refreshControl={refresh}
        contentContainerStyle={{
          padding: 20,
          paddingTop: padTop ? insets.top + 16 : 20,
          paddingBottom: footer ? 20 : insets.bottom + 28,
          gap: 16,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
      >
        {children}
      </KeyboardScroll>
      {footer && (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={{
            padding: 16,
            paddingHorizontal: 20,
            paddingBottom: keyboard > 0 ? keyboard + 12 : insets.bottom + 16,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.line,
            backgroundColor: colors.bg,
            gap: 8,
          }}
        >
          {footer}
        </View>
      )}
    </View>
  )
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'warning' | 'danger' | 'success' }) {
  const { colors, dark } = useTheme()
  const bg = tone ? colors[`${tone}Soft` as const] : colors.surface
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: 18,
          padding: 18,
          gap: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.line,
          shadowColor: '#3b2a10',
          shadowOpacity: dark || tone ? 0 : 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: dark || tone ? 0 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
}) {
  const { colors } = useTheme()
  const id = 'b' + useId().replace(/[^a-zA-Z0-9]/g, '')
  // Drawn at the measured size with its own rounded corners, so the edges stay clean.
  const [box, setBox] = useState({ w: 0, h: 0 })
  const off = disabled || loading
  const primary = variant === 'primary'
  const bg = primary ? (box.w ? 'transparent' : colors.primary) : variant === 'danger' ? colors.dangerSoft : 'transparent'
  const fg = primary ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={label}
      onPress={off ? undefined : onPress}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        if (width !== box.w || height !== box.h) setBox({ w: width, h: height })
      }}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        backgroundColor: bg,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.line,
        opacity: off ? 0.5 : 1,
        transform: [{ scale: pressed && !off ? 0.985 : 1 }],
      })}
    >
      {primary && box.w > 0 && (
        <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={mix(colors.primary, '#ffffff', 0.22)} />
              <Stop offset="1" stopColor={mix(colors.primary, '#000000', 0.1)} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} rx={14} ry={14} fill={`url(#${id})`} />
        </Svg>
      )}
      {loading && <ActivityIndicator color={fg} />}
      <RNText style={{ color: fg, fontSize: 16, fontWeight: '600', letterSpacing: 0.2 }}>{label}</RNText>
    </Pressable>
  )
}

interface FieldProps extends TextInputProps {
  label: string
  error?: string | null
  hint?: string
  prefix?: string
  /** Adds a Show / Hide control and hides the text by default. */
  password?: boolean
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, hint, prefix, password, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme()
  const [hidden, setHidden] = useState(true)
  const [focused, setFocused] = useState(false)
  const box = useRef<View>(null)
  const reveal = useRevealOnFocus()
  return (
    <View ref={box} collapsable={false} style={{ gap: 6 }}>
      <Text size="small" tone="muted" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: error ? colors.danger : focused ? colors.primary : colors.line,
          borderRadius: 14,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
        }}
      >
        {prefix && (
          <RNText style={{ color: colors.muted, fontSize: 17, marginRight: 6 }}>{prefix}</RNText>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          secureTextEntry={password ? hidden : undefined}
          autoCapitalize={password ? 'none' : undefined}
          autoCorrect={password ? false : undefined}
          onFocus={(e) => {
            setFocused(true)
            reveal(box.current)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          {...rest}
          style={[
            { flex: 1, minHeight: 52, fontSize: 17, color: colors.text },
            Platform.OS === 'web' ? { outlineWidth: 0 } : null,
            style,
          ]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
            style={{ paddingLeft: 12, minHeight: 44, justifyContent: 'center' }}
          >
            <RNText style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{hidden ? 'Show' : 'Hide'}</RNText>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text size="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text size="small" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  )
})

export function Pill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'success' | 'warning' | 'danger' }) {
  const { colors } = useTheme()
  const bg = tone === 'muted' ? colors.line : colors[`${tone}Soft` as const]
  const fg = tone === 'muted' ? colors.muted : colors[tone]
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <RNText style={{ color: fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 }}>{label}</RNText>
    </View>
  )
}

export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <Card tone="danger">
      <Text tone="danger" accessibilityLiveRegion="polite">
        {message}
      </Text>
    </Card>
  )
}

export function Row({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 }}>
      <Text tone="muted">{label}</Text>
      <Text tone={tone} style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  )
}

export function Spinner() {
  const { colors } = useTheme()
  return <ActivityIndicator style={{ marginVertical: 32 }} color={colors.primary} />
}

export function Progress({ value }: { value: number }) {
  const { colors } = useTheme()
  const [width] = useState(() => new Animated.Value(0))
  const pct = Math.min(100, Math.max(0, value * 100))
  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 600, useNativeDriver: false }).start()
  }, [width, pct])
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' }}>
      <Animated.View
        style={{
          width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          height: '100%',
          borderRadius: 4,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  )
}
