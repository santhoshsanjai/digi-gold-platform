import {
  AlarmClock,
  BarChart3,
  Circle,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Settings,
  Shield,
  Store,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'

/** The API names menu icons; only these are bundled. */
const ICONS: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'trending-up': TrendingUp,
  users: Users,
  'credit-card': CreditCard,
  store: Store,
  'alarm-clock': AlarmClock,
  'bar-chart': BarChart3,
  'user-cog': UserCog,
  shield: Shield,
  'map-pin': MapPin,
  settings: Settings,
}

export const menuIcon = (name: string): LucideIcon => ICONS[name] ?? Circle
