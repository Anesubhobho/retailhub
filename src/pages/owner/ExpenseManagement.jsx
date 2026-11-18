
import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Wallet,
  X,
  CalendarDays,
  Loader2,
  Receipt
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

const expenseCategories = [
  'Rent',
  'Electricity',
  'Water',
  'Transport',
  'Salaries',
  'Internet',
  'Repairs and Maintenance',
  'Packaging',
  'Security',
  'Other'
]

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'other', label: 'Other' }
]

function getLocalDate() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value || 0))
}

const emptyForm = {
  expense_date: getLocalDate(),
  category: 'Rent',
  description: '',
  amount: '',
  payment_method: 'cash',
  reference: ''
}

export default function ExpenseManagement() {
  const { profile } = useAuth()

  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.role === 'owner' && profile?.shop_id) {
      fetchExpenses()
    }
  }, [profile?.role, profile?.shop_id])

  async function fetchExpenses() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('shop_id', profile.shop_id)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setExpenses([])
    } else {
      setExpenses(data || [])
    }

    setLoading(false)
  }

  function openAddForm() {
    setEditingId(null)
    setForm({ ...emptyForm, expense_date: getLocalDate() })
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function openEditForm(expense) {
    setEditingId(expense.id)
    setForm({
      expense_date: expense.expense_date,
      category: expense.category,
      description: expense.description || '',
      amount: String(expense.amount),
      payment_method: expense.payment_method,
      reference: expense.reference || ''
    })
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm(previous => ({
      ...previous,
      [name]: value
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!profile?.shop_id || !profile?.id) {
      setError('Your account information is incomplete. Please sign in again.')
      return
    }

    if (!form.category.trim()) {
      setError('Please enter an expense category.')
      return
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError('Enter a valid expense amount greater than zero.')
      return
    }

    if (!form.expense_date) {
      setError('Please select an expense date.')
      return
    }

    const expenseData = {
      expense_date: form.expense_date,
      category: form.category.trim(),
      description: form.description.trim() || null,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      reference: form.reference.trim() || null
    }

    setSaving(true)

    let result

    if (editingId) {
      result = await supabase
        .from('expenses')
        .update({
          ...expenseData,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId)
        .eq('shop_id', profile.shop_id)
    } else {
      result = await supabase
        .from('expenses')
        .insert({
          ...expenseData,
          shop_id: profile.shop_id,
          created_by: profile.id
        })
    }

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    setMessage(editingId
      ? 'Expense updated successfully.'
      : 'Expense recorded successfully.'
    )

    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)

    await fetchExpenses()
  }

  async function deleteExpense(expense) {
    const confirmed = window.confirm(
      `Delete this ${expense.category} expense of ${formatCurrency(expense.amount)}?`
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)
      .eq('shop_id', profile.shop_id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMessage('Expense deleted successfully.')
    await fetchExpenses()
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const searchText = search.toLowerCase()

      const matchesSearch =
        expense.category?.toLowerCase().includes(searchText) ||
        expense.description?.toLowerCase().includes(searchText) ||
        expense.reference?.toLowerCase().includes(searchText)

      const matchesCategory =
        categoryFilter === 'all' ||
        expense.category === categoryFilter

      const matchesStart =
        !startDate || expense.expense_date >= startDate

      const matchesEnd =
        !endDate || expense.expense_date <= endDate

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStart &&
        matchesEnd
      )
    })
  }, [expenses, search, categoryFilter, startDate, endDate])

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0
    )
  }, [filteredExpenses])

  const allTimeExpenses = useMemo(() => {
    return expenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0
    )
  }, [expenses])

  if (profile?.role !== 'owner') {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
        <h2 className="text-xl font-bold text-red-600">
          Access denied
        </h2>
        <p className="mt-2 text-slate-500">
          Only shop owners can access expense management.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Expense Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Record and manage your shop operating expenses.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Expense
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Filtered Expenses
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(totalExpenses)}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Based on your selected filters
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Wallet size={25} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                All-Time Expenses
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(allTimeExpenses)}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Total recorded expenses
              </p>
            </div>
            <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
              <Receipt size={25} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">
          Filter Expenses
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search expenses..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All categories</option>
            {[...new Set(expenses.map(item => item.category))].map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={event => setStartDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            aria-label="Start date"
          />

          <input
            type="date"
            value={endDate}
            onChange={event => setEndDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            aria-label="End date"
          />
        </div>

        <button
          onClick={() => {
            setSearch('')
            setCategoryFilter('all')
            setStartDate('')
            setEndDate('')
          }}
          className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Clear filters
        </button>
      </div>

      {/* Expense table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">
              Expense History
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {filteredExpenses.length} expense record(s)
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-slate-500">
            <Loader2 className="animate-spin" size={20} />
            Loading expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="mx-auto text-slate-300" size={42} />
            <h3 className="mt-3 font-semibold text-slate-700">
              No expenses found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Add an expense or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4">
                      {expense.expense_date}
                    </td>

                    <td className="px-5 py-4 font-medium text-slate-800">
                      {expense.category}
                    </td>

                    <td className="px-5 py-4 text-slate-500">
                      {expense.description || '—'}
                      {expense.reference && (
                        <p className="mt-1 text-xs">
                          Ref: {expense.reference}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 capitalize text-slate-600">
                      {paymentMethods.find(
                        method => method.value === expense.payment_method
                      )?.label || expense.payment_method}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                      {formatCurrency(expense.amount)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditForm(expense)}
                          title="Edit expense"
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => deleteExpense(expense)}
                          title="Delete expense"
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan="4" className="px-5 py-4 font-bold text-slate-800">
                    Filtered Total
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-900">
                    {formatCurrency(totalExpenses)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit expense modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? 'Edit Expense' : 'Record New Expense'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the expense details below.
                </p>
              </div>

              <button
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Expense Date *
                  </label>
                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="absolute left-3 top-3 text-slate-400"
                    />
                    <input
                      type="date"
                      name="expense_date"
                      value={form.expense_date}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Category *
                  </label>
                  <input
                    list="expense-categories"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="Select or enter category"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <datalist id="expense-categories">
                    {expenseCategories.map(category => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Describe the expense..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Amount (USD) *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Payment Method *
                  </label>
                  <select
                    name="payment_method"
                    value={form.payment_method}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  >
                    {paymentMethods.map(method => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Reference Number
                </label>
                <input
                  type="text"
                  name="reference"
                  value={form.reference}
                  onChange={handleChange}
                  placeholder="Optional receipt or transaction reference"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving && <Loader2 size={17} className="animate-spin" />}
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Update Expense'
                      : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
