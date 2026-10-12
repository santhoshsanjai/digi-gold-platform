import { Image, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { Text } from './index'

/** The client's logo (when set) and name. */
export function Brand({ size = 56 }: { size?: number }) {
  const { brand, name, colors } = useTheme()
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      {brand.logo_url ? (
        <Image
          source={{ uri: brand.logo_url }}
          accessibilityLabel={`${name} logo`}
          style={{ width: size, height: size, borderRadius: size / 4 }}
          resizeMode="contain"
        />
      ) : (
        <View
          style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.onPrimary, fontSize: size / 2, fontWeight: '700' }}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text size="title" style={{ textAlign: 'center' }}>
        {name}
      </Text>
    </View>
  )
}
