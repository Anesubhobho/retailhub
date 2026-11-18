
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import DashboardLayout from './layouts/DashboardLayout'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import Categories from './pages/owner/Categories'
import Suppliers from './pages/owner/Suppliers'
import Products from './pages/owner/Products'
import ReceiveStock from './pages/employee/ReceiveStock'
import InventoryPage from './pages/shared/InventoryPage'
import POS from './pages/employee/POS'
import SalesHistory from './pages/shared/SalesHistory'
import ExpenseManagement from './pages/owner/ExpenseManagement'
import FinancialDashboard from './pages/owner/FinancialDashboard'
import SalesAnalytics from './pages/owner/SalesAnalytics'
import Reports from './pages/owner/Reports'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <p className="text-slate-500">Loading RetailHub...</p>
    </div>
  )
}

function ProtectedRoute({ role }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) return <Navigate to="/login" replace />

  if (!profile || !profile.is_active) {
    return <Navigate to="/login" replace />
  }

  if (role && profile.role !== role) {
    return (
      <Navigate
        to={profile.role === 'owner' ? '/owner' : '/employee'}
        replace
      />
    )
  }

  return <Outlet />
}

function RoleRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  return (
    <Navigate
      to={profile?.role === 'owner' ? '/owner' : '/employee'}
      replace
    />
  )
}

function PlaceholderPage({ title }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-500">
        This section will be implemented in the next development stage.
      </p>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute role="owner" />}>
        <Route path="/owner" element={<DashboardLayout />}>
          <Route index element={<OwnerDashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="employees" element={<PlaceholderPage title="Employees" />} />
          <Route path="inventory" element={<InventoryPage />} />
         <Route path="analytics" element={<SalesAnalytics />} />
         <Route path="financials" element={<FinancialDashboard />} />
          <Route path="devices" element={<PlaceholderPage title="Devices & Synchronisation" />} />
          <Route path="settings" element={<PlaceholderPage title="Settings" />} />
          <Route path="sales" element={<SalesHistory />} />
          <Route path="expenses" element={<ExpenseManagement />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="employee" />}>
        <Route path="/employee" element={<DashboardLayout />}>
          <Route index element={<EmployeeDashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="receive-stock" element={<ReceiveStock />} />
          <Route path="stock" element={<InventoryPage />} />
          <Route path="sales" element={<SalesHistory />} />
        </Route>
      </Route>

      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
