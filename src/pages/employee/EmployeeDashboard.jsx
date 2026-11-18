
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  ClipboardList,
  ArrowRight
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import StatCard from '../../components/statcard'

export default function EmployeeDashboard() {
  const [productCount, setProductCount] = useState(0)
  const [lowStock, setLowStock] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStock() {
      const [products, stock] = await Promise.all([
        supabase.from('products')
          .select('id', { count: 'exact', head: true }),

        supabase.from('stock_balances')
          .select('available_stock, reorder_level')
      ])

      if (!products.error) setProductCount(products.count || 0)

      if (!stock.error) {
        setLowStock(
          (stock.data || []).filter(
            item => Number(item.available_stock) <= Number(item.reorder_level)
          ).length
        )
      }

      setLoading(false)
    }

    loadStock()
  }, [])

  const actions = [
    {
      title: 'Make a Sale',
      description: 'Open the point of sale and process a customer purchase.',
      icon: ShoppingCart,
      path: '/employee/pos',
      color: 'bg-blue-600'
    },
    {
      title: 'Receive Stock',
      description: 'Record new stock received from suppliers.',
      icon: Package,
      path: '/employee/receive-stock',
      color: 'bg-emerald-600'
    },
    {
      title: 'Available Stock',
      description: 'Check current product quantities and availability.',
      icon: ClipboardList,
      path: '/employee/stock',
      color: 'bg-violet-600'
    }
  ]

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Employee Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome. Select an activity to get started.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Available Products"
          value={loading ? '...' : productCount}
          subtitle="Registered products"
          icon={Package}
        />

        <StatCard
          title="Low Stock Alerts"
          value={loading ? '...' : lowStock}
          subtitle="Products requiring attention"
          icon={ClipboardList}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Quick Actions
        </h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map(({ title, description, icon: Icon, path, color }) => (
            <Link
              key={path}
              to={path}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className={`mb-5 inline-flex rounded-lg p-3 text-white ${color}`}>
                <Icon size={24} />
              </div>

              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">{description}</p>

              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-600">
                Open section
                <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="font-semibold text-blue-900">Important</h3>
        <p className="mt-1 text-sm text-blue-800">
          Always verify product quantities before completing stock operations.
          Cancelled sales will be retained in the system's transaction history.
        </p>
      </div>
    </div>
  )
}
