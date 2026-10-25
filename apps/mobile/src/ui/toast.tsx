/**
 * Short messages that slide in at the top of the screen and leave on their own, the way
 * the phone's own notifications do: "Password updated", "No connection", and so on.
 * Field mistakes stay next to the field; toasts are for the result of an action.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  text: string
}

interface ToastApi {
  success: (text: string) => void
  error: (text: string) => void
  info: (text: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const t = useContext(ToastContext)
  if (!t) throw new Error('useToast outside ToastProvider')
  return t
}

const native = Platform.OS !== 'web'
const COLORS: Record<ToastType, string> = { success: '#1f8a4c', error: '#d23c32', info: '#a8844a' }

function Icon({ type }: { type: ToastType }) {
  const c = COLORS[type]
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill={c} />
      {type === 'success' ? (
        <Path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : type === 'error' ? (
        <Path d="M12 7v6M12 16.5v.5" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M12 11v6M12 7.5v.5" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      )}
    </Svg>
  )
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const [y] = useState(() => new Animated.Value(-120))
  const leaving = useRef(false)

  const leave = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    Animated.timing(y, { toValue: -140, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(onDone)
  }, [y, onDone])

  useEffect(() => {
    Animated.spring(y, { toValue: 0, friction: 9, tension: 80, useNativeDriver: native }).start()
    AccessibilityInfo.announceForAccessibility(toast.text)
    const t = setTimeout(leave, toast.type === 'error' ? 5000 : 3500)
    return () => clearTimeout(t)
  }, [y, leave, toast])

  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Pressable onPress={leave} style={styles.card} accessibilityHint="Dismisses the message">
        <Icon type={toast.type} />
        <Text style={styles.text}>{toast.text}</Text>
      </Pressable>
    </Animated.View>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null)
  const seq = useRef(0)

  const show = useCallback((type: ToastType, text: string) => {
    seq.current += 1
    setCurrent({ id: seq.current, type, text })
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => show('success', t),
      error: (t) => show('error', t),
      info: (t) => show('info', t),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {current && <ToastView key={current.id} toast={current} onDone={() => setCurrent((c) => (c?.id === current.id ? null : c))} />}
      </View>
    </ToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  text: { flex: 1, color: '#1d1d1f', fontSize: 15, lineHeight: 20, fontWeight: '500' },
})
