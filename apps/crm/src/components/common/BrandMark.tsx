import React from 'react'
import { useTheme } from '../../providers/themeContext.ts'

/** The client's logo, or their initial on the brand colour when no logo is set. */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 40 }) => {
  const { brand } = useTheme()
  if (brand.logoUrl) {
    return (
      <img
        src={brand.logoUrl}
        alt={brand.name}
        style={{ height: size, maxWidth: size * 3 }}
        className="object-contain"
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className="rounded-xl bg-primary-500 text-white grid place-items-center font-bold shrink-0"
    >
      {brand.name.charAt(0).toUpperCase()}
    </div>
  )
}
