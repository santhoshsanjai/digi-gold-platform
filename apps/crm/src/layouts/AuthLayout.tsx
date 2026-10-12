import { Outlet } from 'react-router-dom'
import { BrandMark } from '../components/common/BrandMark.tsx'
import { useTheme } from '../providers/themeContext.ts'

export const AuthLayout = () => {
  const { brand } = useTheme()
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-primary-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          <BrandMark size={56} />
          <div>
            <div className="text-xl font-bold font-heading">{brand.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Staff portal</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <Outlet />
        </div>
        {(brand.supportEmail || brand.supportPhone) && (
          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Need help? {[brand.supportPhone, brand.supportEmail].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
