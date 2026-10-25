/**
 * The brand pieces of the welcome screen and the home balance card: warm black, ivory text,
 * the gold coin and its motion. Built on React Native's Animated (native driver) and
 * react-native-svg, both already in the app, so no animation library is added. Forms use
 * the app's ordinary components (src/ui) so every screen shares one style.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg'

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
      <SvgText x="100" y="101" fill="#fff1c2" fillOpacity="0.45" fontSize="78" fontWeight="700" textAnchor="middle" alignmentBaseline="central">
        {initial}
      </SvgText>
      <SvgText x="101" y="103" fill="#6f4c15" fillOpacity="0.85" fontSize="78" fontWeight="700" textAnchor="middle" alignmentBaseline="central">
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


/** A button for the dark welcome screen: solid gold, or an outline. */
export function WelcomeButton({ label, onPress, outline }: { label: string; onPress: () => void; outline?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: outline ? 'transparent' : gold.accent,
        borderWidth: outline ? 1 : 0,
        borderColor: 'rgba(244,238,226,0.28)',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: outline ? gold.text : gold.onAccent, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}