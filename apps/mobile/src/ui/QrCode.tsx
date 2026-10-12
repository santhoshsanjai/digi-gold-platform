import { useMemo } from 'react'
import QRCode from 'qrcode'
import Svg, { Path, Rect } from 'react-native-svg'

/** A QR code drawn as one SVG path, so it stays sharp at any size. */
export function QrCode({ value, size = 200, color = '#000000', background = '#ffffff' }: { value: string; size?: number; color?: string; background?: string }) {
  const { count, path } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    let d = ''
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`
      }
    }
    return { count: n, path: d }
  }, [value])
  const quiet = 2
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`} accessibilityLabel="QR code for store staff">
      <Rect x={-quiet} y={-quiet} width={count + quiet * 2} height={count + quiet * 2} fill={background} />
      <Path d={path} fill={color} />
    </Svg>
  )
}
