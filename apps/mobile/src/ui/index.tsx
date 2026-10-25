import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { useTheme } from '../theme/ThemeProvider'
import { KeyboardScroll, useKeyboardHeight, useRevealOnFocus } from './keyboard'

type Tone = 'normal' | 'muted' | 'success' | 'warning' | 'danger'
type Size = 'title' | 'heading' | 'body' | 'small' | 'big'

/**
 * One type scale, in the phone's own font (San Francisco on iPhone, Roboto on Android), as
 * banking and payment apps use. Sizes follow the platform guidelines.
 */
const tight = Platform.OS === 'ios' ? -0.4 : 0
const SIZES: Record<Size, TextStyle> = {
  big: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: tight, fontVariant: ['tabular-nums'] },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: tight },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
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
  const { colors } = useTheme()
  const bg = tone ? colors[`${tone}Soft` as const] : colors.surface
  return (
    <View
      style={[
        { backgroundColor: bg, borderRadius: 16, padding: 16, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
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
  /** primary: filled; secondary: outlined; danger: destructive; text: a plain text button. */
  variant?: 'primary' | 'secondary' | 'danger' | 'text'
  loading?: boolean
  disabled?: boolean
}) {
  const { colors } = useTheme()
  const off = disabled || loading
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.dangerSoft : 'transparent'
  const fg =
    variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : variant === 'text' ? colors.primary : colors.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={label}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => ({
        minHeight: variant === 'text' ? 44 : 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        backgroundColor: bg,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.line,
        opacity: off && !loading ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {loading && <ActivityIndicator color={fg} />}
      <RNText style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{label}</RNText>
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
      <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '500' }}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: focused || error ? 1.5 : 1,
          borderColor: error ? colors.danger : focused ? colors.primary : colors.line,
          borderRadius: 12,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
        }}
      >
        {prefix && (
          <RNText style={{ color: colors.muted, fontSize: 16, marginRight: 8 }}>{prefix}</RNText>
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
            { flex: 1, minHeight: 50, fontSize: 16, color: colors.text },
            // The field's own border shows focus, so hide the browser's outline in the web preview.
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as TextStyle) : null,
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
      <RNText style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</RNText>
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
