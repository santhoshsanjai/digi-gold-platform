import { forwardRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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

type Tone = 'normal' | 'muted' | 'success' | 'warning' | 'danger'
type Size = 'title' | 'heading' | 'body' | 'small' | 'big'

const SIZES: Record<Size, TextStyle> = {
  big: { fontSize: 40, lineHeight: 46, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
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

/** A scrolling page with the safe-area padding and a consistent gutter. */
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
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={refresh}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingTop: padTop ? insets.top + 16 : 16,
          paddingBottom: footer ? 16 : insets.bottom + 24,
          gap: 16,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
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
        { backgroundColor: bg, borderRadius: 14, padding: 16, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
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
  const off = disabled || loading
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.dangerSoft : 'transparent'
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={label}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        backgroundColor: bg,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.line,
        opacity: off ? 0.5 : pressed ? 0.85 : 1,
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
}

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, hint, prefix, style, ...rest }, ref) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text size="small" tone="muted" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.line,
          borderRadius: 12,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
        }}
      >
        {prefix && (
          <RNText style={{ color: colors.muted, fontSize: 18, marginRight: 6 }}>{prefix}</RNText>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          {...rest}
          style={[{ flex: 1, minHeight: 50, fontSize: 18, color: colors.text }, style]}
        />
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
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
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
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text tone="muted">{label}</Text>
      <Text tone={tone} style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  )
}

export function Spinner() {
  return <ActivityIndicator style={{ marginVertical: 32 }} />
}

export function Progress({ value }: { value: number }) {
  const { colors } = useTheme()
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, height: '100%', backgroundColor: colors.primary }} />
    </View>
  )
}
