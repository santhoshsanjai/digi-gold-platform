import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../src/theme/ThemeProvider'
import { gold, GoldBackdrop, GoldButton, GoldCoinFace, serif, Sheen, useReducedMotion } from '../src/ui/gold'

const native = Platform.OS !== 'web'
// The full introduction plays once per launch; coming back here (after signing out) is quick.
let played = false

/**
 * The first screen for anyone signed out: the coin turns into view, the name and promise
 * appear, then the two actions. Tapping anywhere finishes the sequence at once.
 */
export default function Welcome() {
  const { name, brand } = useTheme()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const quick = reduced || played

  const [coin] = useState(() => new Animated.Value(0))
  const [title] = useState(() => new Animated.Value(0))
  const [copy] = useState(() => new Animated.Value(0))
  const [actions] = useState(() => [new Animated.Value(0), new Animated.Value(0)])
  const [sheen] = useState(() => new Animated.Value(0))
  const [float] = useState(() => new Animated.Value(0))
  const intro = useRef<Animated.CompositeAnimation | null>(null)

  const all = [coin, title, copy, ...actions]
  const size = Math.round(Math.min(width * 0.46, height * 0.26, 220))

  useEffect(() => {
    const t = (v: Animated.Value, duration: number, easing = Easing.out(Easing.cubic)) =>
      Animated.timing(v, { toValue: 1, duration: quick ? 0 : duration, easing, useNativeDriver: native })
    intro.current = Animated.sequence([
      t(coin, 900, Easing.out(Easing.back(1.2))),
      Animated.parallel([t(title, 520), Animated.sequence([Animated.delay(quick ? 0 : 160), t(copy, 520)])]),
      Animated.stagger(quick ? 0 : 130, actions.map((a) => t(a, 460))),
    ])
    intro.current.start(() => {
      played = true
    })

    if (reduced) return () => intro.current?.stop()
    // After the intro: a slow float and an occasional glint, nothing more.
    const idle = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
          Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(quick ? 600 : 1100),
          Animated.timing(sheen, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: native }),
          Animated.delay(4200),
        ]),
      ),
    ])
    idle.start()
    return () => {
      intro.current?.stop()
      idle.stop()
    }
    // Runs once; the values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const finish = () => {
    intro.current?.stop()
    all.forEach((v) => v.setValue(1))
    played = true
  }

  const rise = (v: Animated.Value, by = 14) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }],
  })

  return (
    <Pressable accessible={false} onPress={finish} style={{ flex: 1, backgroundColor: gold.bg }}>
      <StatusBar style="light" />
      <GoldBackdrop glowY={0.36} particles />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          width: '100%',
          maxWidth: 480,
          alignSelf: 'center',
        }}
      >
        <Animated.Text style={[{ color: gold.accent, fontSize: 12, fontWeight: '600', letterSpacing: 3, textAlign: 'center' }, { opacity: title }]}>
          DIGITAL GOLD
        </Animated.Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <Animated.View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${name} gold coin`}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: coin,
              transform: [
                { perspective: 900 },
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
                { rotateY: coin.interpolate({ inputRange: [0, 1], outputRange: ['-80deg', '0deg'] }) },
                { scale: coin.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
              ],
              shadowColor: '#c9973a',
              shadowOpacity: 0.35,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 10 },
            }}
          >
            {brand.logo_url ? (
              <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <GoldCoinFace size={size} initial="" />
                <Image
                  source={{ uri: brand.logo_url }}
                  accessibilityIgnoresInvertColors
                  style={{ position: 'absolute', width: size * 0.5, height: size * 0.5 }}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <GoldCoinFace size={size} initial={name.slice(0, 1).toUpperCase()} />
            )}
            <Sheen size={size} progress={sheen} />
          </Animated.View>

          <View style={{ alignItems: 'center', gap: 12 }}>
            <Animated.Text
              accessibilityRole="header"
              style={[{ color: gold.text, fontFamily: serif, fontSize: 32, lineHeight: 38, fontWeight: '600', textAlign: 'center' }, rise(title)]}
            >
              {name}
            </Animated.Text>
            <Animated.View style={[{ alignItems: 'center', gap: 14 }, rise(copy, 10)]}>
              <View style={{ width: 36, height: 1, backgroundColor: gold.deep }} />
              <Text style={{ color: gold.muted, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 320 }}>
                Save in real gold, a little at a time, and redeem it for jewellery in store.
              </Text>
            </Animated.View>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Animated.View style={rise(actions[0], 18)}>
            <GoldButton label="Create account" onPress={() => router.push('/sign-up')} />
          </Animated.View>
          <Animated.View style={rise(actions[1], 18)}>
            <GoldButton variant="outline" label="Sign in" onPress={() => router.push('/sign-in')} />
          </Animated.View>
        </View>
      </View>
    </Pressable>
  )
}
