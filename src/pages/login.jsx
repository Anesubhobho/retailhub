
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)

      // Retrieve the authenticated profile
      const { supabase } = await import('../services/supabase')

      const { data, error } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', (await supabase.auth.getUser()).data.user.id)
        .single()

      if (error || !data || !data.is_active) {
        throw new Error('Unable to verify account permissions')
      }

      navigate(
        data.role === 'owner'
          ? '/owner'
          : '/employee'
      )
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">

        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-blue-700">
            RetailHub
          </div>

          <p className="text-gray-500 mt-2">
            Retail Management System
          </p>
        </div>

        <h2 className="text-2xl font-bold mb-2">
          Welcome back
        </h2>

        <p className="text-gray-500 mb-6">
          Sign in to access your account.
        </p>

        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="block mb-2 font-medium">
              Email address
            </label>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border rounded-lg p-3 outline-blue-600"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border rounded-lg p-3 outline-blue-600"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white rounded-lg p-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          RetailHub © 2026
        </p>
      </div>
    </div>
  )
}
