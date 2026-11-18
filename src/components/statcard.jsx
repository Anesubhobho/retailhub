
import React from 'react'

export default function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
            <Icon size={22} />
          </div>
        )}
      </div>
    </div>
  )
}
