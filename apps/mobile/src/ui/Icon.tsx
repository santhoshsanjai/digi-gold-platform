import type { ColorValue } from 'react-native'
import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'

/** Outline icons on a 24-point grid, drawn with one stroke weight so they sit together. */
const PATHS = {
  phone: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10.5 18h3',
  mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM3.5 7l8.5 6 8.5-6',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  badge: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM9 11a2 2 0 1 0 0-.01M6 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 14h3',
  card: 'M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 10h18M7 15h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3M12 15v2',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  logout: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h10',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01',
  call: 'M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  chevron: 'M9 5l7 7-7 7',
  coins: 'M9 10c3.3 0 6-1.1 6-2.5S12.3 5 9 5 3 6.1 3 7.5 5.7 10 9 10zM3 7.5v4C3 12.9 5.7 14 9 14s6-1.1 6-2.5v-4M9 18c-3.3 0-6-1.1-6-2.5v-4M15 13.3c3.4-.2 6-1.2 6-2.6s-2.7-2.5-6-2.5M21 10.7v4c0 1.4-2.7 2.5-6 2.5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v4M4 7v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9H6a2 2 0 0 1-2-2zM16 14h.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  store: 'M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M3 10l2-6h14l2 6zM3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M10 20v-5h4v5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z M9 12l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  refund: 'M4 9h11a5 5 0 0 1 0 10H8M8 5L4 9l4 4',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  scale: 'M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, color, size = 20, strokeWidth = 1.8 }: { name: IconName; color: ColorValue; size?: number; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
    </Svg>
  )
}

type Tint = 'primary' | 'success' | 'warning' | 'danger' | 'muted'

/** An icon in a softly tinted rounded square, the way list rows in settings screens show them. */
export function IconBadge({ name, tint = 'primary', size = 36 }: { name: IconName; tint?: Tint; size?: number }) {
  const { colors } = useTheme()
  const fg = tint === 'muted' ? colors.muted : colors[tint]
  const bg = tint === 'primary' ? colors.primarySoft : tint === 'muted' ? colors.line : colors[`${tint}Soft` as const]
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} color={fg} size={size * 0.52} />
    </View>
  )
}
