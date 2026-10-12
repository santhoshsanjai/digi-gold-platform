import React from 'react'

interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 m-0">{title}</h1>
      {description && (
        <p className="mt-1 mb-0 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
  </div>
)
