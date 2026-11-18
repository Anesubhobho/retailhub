
import { useEffect, useState } from 'react'
import {
  Package,
  AlertTriangle,
  Tags,
  Truck,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import StatCard from '../../components/statCard'

export default function OwnerDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    categories: 0,
    suppliers: 0
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const [
        productsResult,
        categoriesResult,
        suppliersResult,
        stockResult
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('categories')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('suppliers')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('stock_balances')
          .select('available_stock, reorder_level')
      ])

      const results = [
        productsResult,
        categoriesResult,
        suppliersResult,
        stockResult
      ]

      const failed = results.find(result => result.error)
      if (failed) throw failed.error

      const lowStock = (stockResult.data || []).filter(
        item => Number(item.available_stock) <= Number(item.reorder_level)
      ).length

      setStats({
        products: productsResult.count || 0,
        categories: categoriesResult.count || 0,
        suppliers: suppliersResult.count || 0,
        lowStock
      })
    } catch (err) {
      setError(err.message || 'Unable to load dashboard information.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Owner Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor and manage your retail business.
          </p>
        </div>

        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500">
          Loading business information...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Products"
              value={stats.products}
              subtitle="Registered products"
              icon={Package}
            />

            <StatCard
              title="Low Stock Alerts"
              value={stats.lowStock}
              subtitle="At or below reorder level"
              icon={AlertTriangle}
            />

            <StatCard
              title="Categories"
              value={stats.categories}
              subtitle="Product categories"
              icon={Tags}
            />

            <StatCard
              title="Suppliers"
              value={stats.suppliers}
              subtitle="Registered suppliers"
              icon={Truck}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Business Performance
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Sales, revenue, expenses and profit analytics will appear here
                once the sales and expenses modules are connected.
              </p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Inventory Management
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                You can manage products, monitor stock levels and review stock
                movements from the inventory section.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
