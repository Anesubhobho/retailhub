
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  Package,
  DollarSign,
  RefreshCw,
  Trophy,
  CalendarDays,
  Activity
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

const money = value =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value || 0))

function localDate(date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10)
}

function getRange(period) {
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
    start: period === 'all' ? '2000-01-01' : localDate(start),
    end
  }
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600'
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-xl p-3 ${styles[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )
}

function BarList({ items, valueKey, labelKey, formatter, color = 'bg-blue-600' }) {
  const maximum = Math.max(
    1,
    ...items.map(item => Number(item[valueKey] || 0))
  )

  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No data available for this period.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {items.map((item, index) => (
        <div key={`${item[labelKey]}-${index}`}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">
              {item[labelKey]}
            </span>
            <span className="shrink-0 font-semibold text-slate-900">
              {formatter(item[valueKey])}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${color}`}
              style={{
                width: `${Math.max(0, Number(item[valueKey] || 0) / maximum * 100)}%`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SalesAnalytics() {
  const { profile } = useAuth()

  const [period, setPeriod] = useState('week')
  const [sales, setSales] = useState([])
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAnalytics = useCallback(async () => {
    if (profile?.role !== 'owner' || !profile?.shop_id) return

    setLoading(true)
    setError('')

    const { start, end } = getRange(period)

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, created_at, total_amount, status, cancelled_at')
      .eq('shop_id', profile.shop_id)
      .eq('status', 'completed')
      .is('cancelled_at', null)
      .gte('created_at', `${start}T00:00:00`)
      .lt(
        'created_at',
        `${localDate(new Date(new Date(`${end}T00:00:00`).getTime() + 86400000))}T00:00:00`
      )
      .order('created_at', { ascending: true })

    if (salesError) {
      setError(salesError.message)
      setSales([])
      setItems([])
      setProducts([])
      setLoading(false)
      return
    }

    const validSales = salesData || []
    setSales(validSales)

    if (!validSales.length) {
      setItems([])
      setProducts([])
      setLoading(false)
      return
    }

    const saleIds = validSales.map(sale => sale.id)

    const { data: itemData, error: itemError } = await supabase
      .from('sale_items')
      .select('id, sale_id, product_id, quantity, unit_price, unit_cost, line_total')
      .eq('shop_id', profile.shop_id)
      .in('sale_id', saleIds)

    if (itemError) {
      setError(itemError.message)
      setItems([])
      setProducts([])
      setLoading(false)
      return
    }

    const validItems = itemData || []
    setItems(validItems)

    const productIds = [
      ...new Set(validItems.map(item => item.product_id).filter(Boolean))
    ]

    if (productIds.length) {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name')
        .eq('shop_id', profile.shop_id)
        .in('id', productIds)

      if (productError) {
        setError(productError.message)
        setProducts([])
      } else {
        setProducts(productData || [])
      }
    } else {
      setProducts([])
    }

    setLoading(false)
  }, [profile?.role, profile?.shop_id, period])

  useEffect(() => {
    if (profile?.role === 'owner') {
      loadAnalytics()
    }
  }, [profile?.role, loadAnalytics])

  const analytics = useMemo(() => {
    const productNames = Object.fromEntries(
      products.map(product => [product.id, product.name])
    )

    const revenue = items.reduce(
      (sum, item) => sum + Number(item.line_total || 0), 0
    )

    const cost = items.reduce(
      (sum, item) => sum + Number(item.unit_cost || 0) * Number(item.quantity || 0),
      0
    )

    const grossProfit = revenue - cost

    const quantity = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0), 0
    )

    const productMap = {}

    items.forEach(item => {
      const id = item.product_id || item.id
      const name = productNames[item.product_id] || 'Unknown product'

      if (!productMap[id]) {
        productMap[id] = {
          name,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0
        }
      }

      const product = productMap[id]
      const itemQuantity = Number(item.quantity || 0)
      const itemRevenue = Number(item.line_total || 0)
      const itemCost = Number(item.unit_cost || 0) * itemQuantity

      product.quantity += itemQuantity
      product.revenue += itemRevenue
      product.cost += itemCost
      product.profit += itemRevenue - itemCost
    })

    const productList = Object.values(productMap)

    const bestSellers = [...productList]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    const topRevenue = [...productList]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    const topProfit = [...productList]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    const dailyMap = {}

    sales.forEach(sale => {
      const date = localDate(new Date(sale.created_at))

      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          revenue: 0,
          sales: 0
        }
      }

      dailyMap[date].sales += 1
    })

    items.forEach(item => {
      const sale = sales.find(s => s.id === item.sale_id)
      if (!sale) return

      const date = localDate(new Date(sale.created_at))
      if (dailyMap[date]) {
        dailyMap[date].revenue += Number(item.line_total || 0)
      }
    })

    const trend = Object.values(dailyMap).sort(
      (a, b) => a.date.localeCompare(b.date)
    )

    const weekdayMap = Array.from({ length: 7 }, (_, day) => ({
      day,
      name: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
      sales: 0,
      revenue: 0
    }))

    sales.forEach(sale => {
      const day = new Date(sale.created_at).getDay()
      weekdayMap[day].sales += 1
    })

    items.forEach(item => {
      const sale = sales.find(s => s.id === item.sale_id)
      if (!sale) return

      const day = new Date(sale.created_at).getDay()
      weekdayMap[day].revenue += Number(item.line_total || 0)
    })

    return {
      revenue,
      cost,
      grossProfit,
      quantity,
      completedSales: sales.length,
      bestSellers,
      topRevenue,
      topProfit,
      trend,
      weekdayMap
    }
  }, [sales, items, products])

  if (profile?.role !== 'owner') {
    return (
      <div className="rounded-xl bg-white p-8 text-center">
        <h2 className="font-bold text-red-600">Access denied</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only shop owners can view sales analytics.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Sales Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Understand sales trends, product performance and profitability.
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
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
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <RefreshCw size={25} className="mx-auto mb-3 animate-spin" />
          Loading sales analytics...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Sales Revenue"
              value={money(analytics.revenue)}
              subtitle="Completed transactions"
              icon={DollarSign}
              color="blue"
            />

            <StatCard
              title="Gross Profit"
              value={money(analytics.grossProfit)}
              subtitle="After product costs"
              icon={TrendingUp}
              color="green"
            />

            <StatCard
              title="Completed Sales"
              value={analytics.completedSales.toLocaleString()}
              subtitle="Number of transactions"
              icon={BarChart3}
              color="purple"
            />

            <StatCard
              title="Units Sold"
              value={analytics.quantity.toLocaleString()}
              subtitle="Total quantities sold"
              icon={Package}
              color="orange"
            />
          </div>

          {/* Sales trend */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <Activity className="text-blue-600" size={22} />
              <div>
                <h2 className="font-bold text-slate-900">Sales Trend</h2>
                <p className="text-xs text-slate-500">
                  Revenue and completed transactions by day
                </p>
              </div>
            </div>

            {analytics.trend.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                No completed sales in this period.
              </p>
            ) : (
              <div className="space-y-4">
                {analytics.trend.map(day => {
                  const maximum = Math.max(
                    1,
                    ...analytics.trend.map(item => item.revenue)
                  )

                  return (
                    <div key={day.date}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="text-slate-600">{day.date}</span>
                        <span className="font-semibold text-slate-900">
                          {money(day.revenue)}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            ({day.sales} sales)
                          </span>
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{
                            width: `${day.revenue / maximum * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Product performance */}
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <Trophy className="text-orange-500" size={22} />
                <div>
                  <h2 className="font-bold text-slate-900">
                    Best-Selling Products
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ranked by quantity sold
                  </p>
                </div>
              </div>

              <BarList
                items={analytics.bestSellers}
                valueKey="quantity"
                labelKey="name"
                formatter={value => `${value} units`}
                color="bg-orange-500"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <TrendingUp className="text-green-600" size={22} />
                <div>
                  <h2 className="font-bold text-slate-900">
                    Top Products by Revenue
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ranked by sales value
                  </p>
                </div>
              </div>

              <BarList
                items={analytics.topRevenue}
                valueKey="revenue"
                labelKey="name"
                formatter={money}
                color="bg-blue-600"
              />
            </div>
          </div>

          {/* Product profit */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <TrendingUp className="text-green-600" size={22} />
              <div>
                <h2 className="font-bold text-slate-900">
                  Most Profitable Products
                </h2>
                <p className="text-xs text-slate-500">
                  Ranked by gross profit contribution
                </p>
              </div>
            </div>

            <BarList
              items={analytics.topProfit}
              valueKey="profit"
              labelKey="name"
              formatter={money}
              color="bg-green-600"
            />
          </div>

          {/* Weekday performance */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h2 className="font-bold text-slate-900">
                Sales Activity by Day
              </h2>
              <p className="text-xs text-slate-500">
                Completed transactions grouped by weekday in the selected period
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {analytics.weekdayMap.map(day => (
                <div
                  key={day.name}
                  className="rounded-lg bg-slate-50 p-4 text-center"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {day.name.slice(0, 3)}
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {day.sales}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">sales</p>
                  <p className="mt-2 text-xs font-semibold text-blue-600">
                    {money(day.revenue)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            Analytics include completed sales only. Cancelled sales are excluded.
            Product profit uses the historical unit cost stored with each sale.
          </div>
        </>
      )}
    </div>
  )
}
