
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Layers,
  Truck,
  Boxes,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Users,
  BarChart3,
  FileText,
  Settings
} from 'lucide-react'

import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import StatCard from "../../components/statcard";
import LowStockAlerts from '../../components/LowStockAlerts'


export default function OwnerDashboard() {
  const { profile } = useAuth()

  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
    suppliers: 0,
    employees: 0,
    totalUnits: 0,
    lowStock: 0,
    outOfStock: 0
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!profile?.shop_id) return

    setLoading(true)
    setError('')

    try {
      const shopId = profile.shop_id

      const [
        productsResult,
        categoriesResult,
        suppliersResult,
        employeesResult,
        inventoryResult
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('is_active', true),

        supabase
          .from('categories')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId),

        supabase
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId),

        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('role', 'employee')
          .eq('is_active', true),

        supabase
          .from('inventory_stock_balances')
          .select('product_id, available_stock, reorder_level')
          .eq('shop_id', shopId)
          .eq('is_active', true)
      ])

      const results = [
        productsResult,
        categoriesResult,
        suppliersResult,
        employeesResult,
        inventoryResult
      ]

      const failed = results.find(result => result.error)

      if (failed) {
        throw failed.error
      }

      const inventory = inventoryResult.data || []

      const totalUnits = inventory.reduce(
        (sum, product) =>
          sum + Number(product.available_stock || 0),
        0
      )

      const lowStock = inventory.filter(product => {
        const stock = Number(product.available_stock || 0)
        const reorder = Number(product.reorder_level || 0)

        return stock > 0 && stock <= reorder
      }).length

      const outOfStock = inventory.filter(
        product => Number(product.available_stock || 0) <= 0
      ).length

      setStats({
        products: productsResult.count || 0,
        categories: categoriesResult.count || 0,
        suppliers: suppliersResult.count || 0,
        employees: employeesResult.count || 0,
        totalUnits,
        lowStock,
        outOfStock
      })
    } catch (err) {
      console.error('Owner dashboard error:', err)
      setError(err.message || 'Unable to load dashboard information.')
    } finally {
      setLoading(false)
    }
  }, [profile?.shop_id])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const formatNumber = value =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 3
    }).format(value)

  const quickLinks = [
    {
      title: 'Manage Products',
      description: 'Add, edit and manage shop products.',
      path: '/owner/products',
      icon: Package
    },
    {
      title: 'Manage Categories',
      description: 'Organise products into categories.',
      path: '/owner/categories',
      icon: Layers
    },
    {
      title: 'Manage Suppliers',
      description: 'Maintain supplier information.',
      path: '/owner/suppliers',
      icon: Truck
    },
    {
      title: 'Inventory',
      description: 'Monitor stock and product availability.',
      path: '/owner/inventory',
      icon: Boxes
    },
    {
      title: 'Employees',
      description: 'Manage employee accounts.',
      path: '/owner/employees',
      icon: Users
    },
    {
      title: 'Analytics',
      description: 'Review sales and business performance.',
      path: '/owner/analytics',
      icon: BarChart3
    },
    {
      title: 'Reports',
      description: 'View and generate business reports.',
      path: '/owner/reports',
      icon: FileText
    },
    {
      title: 'Settings',
      description: 'Manage shop settings and preferences.',
      path: '/owner/settings',
      icon: Settings
    }
  ]

  return (
    <div className="space-y-8">

      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Owner Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor your shop, inventory and business operations.
          </p>
        </div>

        <button
          onClick={loadDashboard}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh Dashboard
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main statistics */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Shop Overview
          </h2>
          <p className="text-sm text-slate-500">
            Key information about your shop.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Active Products"
            value={loading ? '...' : formatNumber(stats.products)}
            subtitle="Products registered"
            icon={Package}
          />

          <StatCard
            title="Categories"
            value={loading ? '...' : formatNumber(stats.categories)}
            subtitle="Product categories"
            icon={Layers}
          />

          <StatCard
            title="Suppliers"
            value={loading ? '...' : formatNumber(stats.suppliers)}
            subtitle="Registered suppliers"
            icon={Truck}
          />

          <StatCard
            title="Employees"
            value={loading ? '...' : formatNumber(stats.employees)}
            subtitle="Active employee accounts"
            icon={Users}
          />
        </div>
      </section>

      {/* Inventory statistics */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Inventory Summary
          </h2>
          <p className="text-sm text-slate-500">
            Current stock position across active products.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Stock Units"
            value={loading ? '...' : formatNumber(stats.totalUnits)}
            subtitle="Combined available quantity"
            icon={Boxes}
          />

          <StatCard
            title="Low Stock Products"
            value={loading ? '...' : formatNumber(stats.lowStock)}
            subtitle="At or below reorder level"
            icon={AlertTriangle}
          />

          <StatCard
            title="Out of Stock"
            value={loading ? '...' : formatNumber(stats.outOfStock)}
            subtitle="Products with zero stock"
            icon={XCircle}
          />

          <StatCard
            title="Stock Health"
            value={
              loading
                ? '...'
                : stats.lowStock + stats.outOfStock === 0
                  ? 'Healthy'
                  : 'Attention'
            }
            subtitle="Based on reorder levels"
            icon={BarChart3}
          />
        </div>
      </section>

      {/* Low stock alerts */}
      <section>
        <LowStockAlerts />
      </section>

      {/* Quick navigation */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Shop Management
          </h2>

          <p className="text-sm text-slate-500">
            Quickly access your management tools.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map(item => {
            const Icon = item.icon

            return (
              <Link
                key={item.path}
                to={item.path}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
                    <Icon size={22} />
                  </div>

                  <ArrowRight
                    size={18}
                    className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
                  />
                </div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  {item.title}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {item.description}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Owner access reminder */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-medium text-blue-900">
          Owner management access
        </p>
        <p className="mt-1 text-sm text-blue-700">
          This dashboard is for shop administration and monitoring.
          Sales processing remains available through employee accounts.
        </p>
      </div>

    </div>
  )
}
