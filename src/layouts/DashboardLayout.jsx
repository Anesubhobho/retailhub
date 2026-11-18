
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  Users,
  ShoppingCart,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Wallet
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ownerLinks = [
  { name: 'Overview', path: '/owner', icon: LayoutDashboard },
  { name: 'Products', path: '/owner/products', icon: Package },
  { name: 'Categories', path: '/owner/categories', icon: Tags },
  { name: 'Suppliers', path: '/owner/suppliers', icon: Truck },
  { name: 'Employees', path: '/owner/employees', icon: Users },
  { name: 'Inventory', path: '/owner/inventory', icon: ClipboardList },
  { name: 'Sales Analytics', path: '/owner/analytics', icon: BarChart3 },
  { name: 'Reports', path: '/owner/reports', icon: ClipboardList },
  { name: 'Devices & Sync', path: '/owner/devices', icon: RefreshCw },
  { name: 'Settings', path: '/owner/settings', icon: Settings },
  { name: 'Sales History', path: '/owner/sales', icon: BarChart3 },
  { name: 'Expenses', path: '/owner/expenses', icon: Wallet }
]

const employeeLinks = [
  { name: 'Overview', path: '/employee', icon: LayoutDashboard },
  { name: 'Point of Sale', path: '/employee/pos', icon: ShoppingCart },
  { name: 'Receive Stock', path: '/employee/receive-stock', icon: Package },
  { name: 'Available Stock', path: '/employee/stock', icon: ClipboardList },
  { name: 'Sales History', path: '/employee/sales', icon: BarChart3 }
]

export default function DashboardLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isOwner = profile?.role === 'owner'
  const links = isOwner ? ownerLinks : employeeLinks

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-white transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Retail<span className="text-blue-400">Hub</span>
            </h1>
            <p className="text-xs text-slate-400">Retail Management</p>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-sm font-semibold">
            {profile?.full_name || 'User'}
          </p>
          <span className="mt-1 inline-block rounded-full bg-blue-500/20 px-2 py-1 text-xs capitalize text-blue-300">
            {profile?.role}
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {links.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/owner' || path === '/employee'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={19} />
              {name}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={19} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="hidden text-sm text-slate-500 sm:block">
            RetailHub / {isOwner ? 'Owner Portal' : 'Employee Portal'}
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
              USD
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
