
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import {
  AlertTriangle,
  XCircle,
  RefreshCw,
  Package
} from 'lucide-react'

export default function LowStockAlerts() {
  const { profile } = useAuth()

  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAlerts = useCallback(async () => {
    if (!profile?.shop_id) return

    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('inventory_stock_balances')
      .select(
        'product_id, name, sku, available_stock, reorder_level'
      )
      .eq('shop_id', profile.shop_id)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Low-stock alert error:', error)
      setError(error.message)
      setAlerts([])
    } else {
      const productsNeedingAttention = (data || [])
        .map(product => ({
          ...product,
          stock: Number(product.available_stock || 0),
          reorder: Number(product.reorder_level || 0)
        }))
        .filter(product => product.stock <= product.reorder)
        .sort((a, b) => a.stock - b.stock)

      setAlerts(productsNeedingAttention)
    }

    setLoading(false)
  }, [profile?.shop_id])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const outOfStock = alerts.filter(
    product => product.stock <= 0
  ).length

  const lowStock = alerts.length - outOfStock

  const numberFormat = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3
  })

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={21} />
            <h2 className="text-lg font-semibold text-slate-900">
              Stock Alerts
            </h2>

            {!loading && alerts.length > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                {alerts.length}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Products that need stock replenishment.
          </p>
        </div>

        <button
          onClick={loadAlerts}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-5">
          <div className="rounded-lg bg-red-50 p-3">
            <p className="text-xs font-medium text-red-600">
              Out of stock
            </p>
            <p className="mt-1 text-xl font-bold text-red-700">
              {outOfStock}
            </p>
          </div>

          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-600">
              Low stock
            </p>
            <p className="mt-1 text-xl font-bold text-amber-700">
              {lowStock}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Checking stock levels...
        </div>
      ) : error ? (
        <div className="p-5 text-sm text-red-600">
          Could not load stock alerts: {error}
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-8 text-center">
          <Package className="mx-auto text-green-500" size={30} />
          <p className="mt-2 font-medium text-slate-800">
            All stock levels are healthy.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            No products currently need replenishment.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {alerts.map(product => {
            const isOut = product.stock <= 0

            return (
              <div
                key={product.product_id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${
                    isOut
                      ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-600'
                  }`}>
                    {isOut
                      ? <XCircle size={19} />
                      : <AlertTriangle size={19} />
                    }
                  </div>

                  <div>
                    <p className="font-medium text-slate-900">
                      {product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      SKU: {product.sku || 'Not assigned'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Reorder level: {numberFormat.format(product.reorder)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isOut
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isOut ? 'Out of stock' : 'Low stock'}
                  </span>

                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {numberFormat.format(product.stock)} available
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-xs text-slate-500">
          Alerts are calculated from current stock movements and product reorder levels.
        </p>
      </div>
    </section>
  )
}
