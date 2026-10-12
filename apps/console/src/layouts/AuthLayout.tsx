import { Outlet } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'

export const AuthLayout = () => (
  <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-primary-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-3 mb-6 text-center">
        <div className="w-14 h-14 rounded-xl bg-primary-500 text-white grid place-items-center">
          <LayoutGrid size={28} />
        </div>
        <div>
          <div className="text-xl font-bold font-heading">Platform Console</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Clients, branding and websites</div>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <Outlet />
      </div>
    </div>
  </div>
)
