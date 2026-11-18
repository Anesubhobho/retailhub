
import { useCallback, useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Wallet,
  Package,
  RefreshCw,
  CalendarDays
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

function localDate(date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10)
}

function getDateRange(period) {
  const today = new Date()
  const end = localDate(today)
  const start = new Date(today)

  if (period === 'week') {
    start.setDate(today.getDate() - 6)
  } else if (period === 'month') {
    start.setDate(1)
  } else if (period === 'year') {
    start.setMonth(0, 1)
  }

  return {
    startDate: period === 'all' ? '2000-01-01' : localDate(start),
    endDate: end
  }
}

function currency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value || 0))
}

function MetricCard({ title, value, description, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {currency(value)}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${colors[color]}`}>
          <Icon size={25} />
        </div>
      </div>
    </div>
  )
}

export default function FinancialDashboard() {
  const { profile } = useAuth()

  const [period, setPeriod] = useState('today')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadFinancialData = useCallback(async () => {
    if (profile?.role !== 'owner') return

    setLoading(true)
    setError('')

    const { startDate, endDate } = getDateRange(period)

    const { data, error: fetchError } = await supabase.rpc(
      'get_shop_financial_summary',
      {
        p_start_date: startDate,
        p_end_date: endDate
      }
    )

    if (fetchError) {
      setError(fetchError.message)
      setSummary(null)
    } else {
      setSummary(data?.[0] || null)
    }

    setLoading(false)
  }, [profile?.role, period])

  useEffect(() => {
    if (profile?.role === 'owner') {
      loadFinancialData()
    }
  }, [profile?.role, loadFinancialData])

  if (profile?.role !== 'owner') {
    return (
      <div className="rounded-xl bg-white p-8 text-center">
        <h2 className="font-bold text-red-600">Access denied</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only shop owners can view financial information.
        </p>
      </div>
    )
  }

  const metrics = summary || {
    total_revenue: 0,
    cost_of_goods: 0,
    gross_profit: 0,
    operating_expenses: 0,
    net_profit: 0,
    completed_sales: 0,
    units_sold: 0
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Financial Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor revenue, costs, expenses and business profitability.
          </p>
        </div>

        <button
          onClick={loadFinancialData}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <CalendarDays size={19} className="text-slate-500" />

        {[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Last 7 days' },
          { value: 'month', label: 'This month' },
          { value: 'year', label: 'This year' },
          { value: 'all', label: 'All time' }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => setPeriod(option.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              period === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Unable to load financial information:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <RefreshCw size={25} className="mx-auto mb-3 animate-spin" />
          Loading financial information...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Total Revenue"
              value={metrics.total_revenue}
              description="Completed sales only"
              icon={DollarSign}
              color="blue"
            />

            <MetricCard
              title="Cost of Goods Sold"
              value={metrics.cost_of_goods}
              description="Historical product costs"
              icon={Package}
              color="orange"
            />

            <MetricCard
              title="Gross Profit"
              value={metrics.gross_profit}
              description="Revenue minus product costs"
              icon={TrendingUp}
              color="green"
            />

            <MetricCard
              title="Operating Expenses"
              value={metrics.operating_expenses}
              description="Recorded shop expenses"
              icon={Wallet}
              color="orange"
            />

            <MetricCard
              title="Net Profit"
              value={metrics.net_profit}
              description="Gross profit minus expenses"
              icon={metrics.net_profit >= 0 ? TrendingUp : TrendingDown}
              color={metrics.net_profit >= 0 ? 'green' : 'red'}
            />

            <MetricCard
              title="Completed Sales"
              value={metrics.completed_sales}
               format="number"
              description={`${metrics.units_sold} units sold`}
              icon={ShoppingBag}
              color="blue"
             
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Profitability Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Financial performance for the selected period.
            </p>

            <div className="mt-6 space-y-4">
              {[
                ['Revenue', metrics.total_revenue],
                ['Cost of goods', metrics.cost_of_goods],
                ['Gross profit', metrics.gross_profit],
                ['Operating expenses', metrics.operating_expenses],
                ['Net profit', metrics.net_profit]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-slate-100 pb-3"
                >
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className={`font-semibold ${
                    label === 'Net profit'
                      ? Number(value) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                      : 'text-slate-900'
                  }`}>
                    {currency(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Cancelled sales are excluded. Profit figures use the historical
            unit costs recorded with each sale.
          </p>
        </>
      )}
    </div>
  )
}
