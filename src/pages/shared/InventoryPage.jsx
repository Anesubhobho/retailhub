
import { useEffect, useMemo, useState } from 'react'
import {
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
          <Icon size={23} />
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { profile } = useAuth()

  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadInventory() {
    if (!profile?.shop_id) return

    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('inventory_stock_balances')
      .select('*')
      .eq('shop_id', profile.shop_id)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Inventory loading error:', error)
      setError(error.message)
      setProducts([])
    } else {
      setProducts(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadInventory()
  }, [profile?.shop_id])

  const inventory = useMemo(() => {
    return products.map(product => ({
      ...product,
      stock: Number(product.available_stock || 0),
      reorder: Number(product.reorder_level || 0)
    }))
  }, [products])

  const statistics = useMemo(() => {
    const totalUnits = inventory.reduce(
      (total, product) => total + product.stock,
      0
    )

    const lowStock = inventory.filter(
      product =>
        product.stock > 0 &&
        product.stock <= product.reorder
    ).length

    const outOfStock = inventory.filter(
      product => product.stock <= 0
    ).length

    return {
      totalProducts: inventory.length,
      totalUnits,
      lowStock,
      outOfStock
    }
  }, [inventory])

  const filteredProducts = inventory.filter(product => {
    const searchMatch =
      product.name?.toLowerCase().includes(search.toLowerCase()) ||
      product.sku?.toLowerCase().includes(search.toLowerCase())

    let filterMatch = true

    if (filter === 'low') {
      filterMatch =
        product.stock > 0 &&
        product.stock <= product.reorder
    }

    if (filter === 'out') {
      filterMatch = product.stock <= 0
    }

    if (filter === 'available') {
      filterMatch = product.stock > product.reorder
    }

    return searchMatch && filterMatch
  })

  function getStatus(product) {
    if (product.stock <= 0) {
      return {
        label: 'Out of stock',
        style: 'bg-red-100 text-red-700'
      }
    }

    if (product.stock <= product.reorder) {
      return {
        label: 'Low stock',
        style: 'bg-amber-100 text-amber-700'
      }
    }

    return {
      label: 'In stock',
      style: 'bg-green-100 text-green-700'
    }
  }

  const numberFormat = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View current stock levels and monitor product availability.
          </p>
        </div>

        <button
          onClick={loadInventory}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Products"
          value={numberFormat.format(statistics.totalProducts)}
          subtitle="Products being tracked"
          icon={Package}
        />

        <StatCard
          title="Total Units"
          value={numberFormat.format(statistics.totalUnits)}
          subtitle="Combined stock quantity"
          icon={Boxes}
        />

        <StatCard
          title="Low Stock"
          value={numberFormat.format(statistics.lowStock)}
          subtitle="At or below reorder level"
          icon={AlertTriangle}
        />

        <StatCard
          title="Out of Stock"
          value={numberFormat.format(statistics.outOfStock)}
          subtitle="Products with zero stock"
          icon={XCircle}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Could not load inventory:</strong> {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Stock Overview
            </h2>
            <p className="text-sm text-slate-500">
              Current quantities are calculated from stock movements.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search product or SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'All products'],
                ['available', 'In stock'],
                ['low', 'Low stock'],
                ['out', 'Out of stock']
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    filter === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading inventory...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4 text-right">Available stock</th>
                  <th className="px-5 py-4 text-right">Reorder level</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => {
                  const status = getStatus(product)

                  return (
                    <tr
                      key={product.product_id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {product.name}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {product.sku || '—'}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-slate-900">
                        {numberFormat.format(product.stock)}
                      </td>

                      <td className="px-5 py-4 text-right text-slate-600">
                        {numberFormat.format(product.reorder)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.style}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No matching products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          Showing {filteredProducts.length} of {inventory.length} active products
        </div>
      </div>
    </div>
  )
}
