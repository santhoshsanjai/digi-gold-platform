import React from 'react'
import { Card } from './Card.tsx'

interface StatCardProps {
  title: string
  value: React.ReactNode
  change?: React.ReactNode
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: React.ReactNode
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
}) => {
  return (
    <Card hoverable className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight font-heading">
            {value}
          </p>
          {change && (
            <p
              className={`mt-2 text-xs font-semibold flex items-center gap-1 ${
                changeType === 'positive'
                  ? 'text-emerald-600'
                  : changeType === 'negative'
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-200 rounded-xl">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
