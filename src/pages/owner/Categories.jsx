
import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Power,
  Tags,
  X,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../../services/supabase'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [shopId, setShopId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    name: '',
    description: ''
  })

  async function loadCategories() {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('You must be logged in.')
      }

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('shop_id')
          .eq('id', authData.user.id)
          .single()

      if (profileError) throw profileError
      if (!profile?.shop_id) {
        throw new Error('No shop is assigned to your account.')
      }

      setShopId(profile.shop_id)

      const { data, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, description, is_active, created_at')
        .eq('shop_id', profile.shop_id)
        .order('name', { ascending: true })

      if (categoryError) throw categoryError

      setCategories(data || [])
    } catch (err) {
      setError(err.message || 'Unable to load categories.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  function openAddForm() {
    setEditingId(null)
    setForm({ name: '', description: '' })
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  function openEditForm(category) {
    setEditingId(category.id)
    setForm({
      name: category.name,
      description: category.description || ''
    })
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const name = form.name.trim()
    const description = form.description.trim()

    if (!name) {
      setError('Please enter a category name.')
      return
    }

    if (!shopId) {
      setError('Shop information is unavailable. Refresh the page.')
      return
    }

    setSaving(true)

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ name, description })
          .eq('id', editingId)
          .eq('shop_id', shopId)

        if (updateError) throw updateError

        setSuccess('Category updated successfully.')
      } else {
        const { error: insertError } = await supabase
          .from('categories')
          .insert({
            shop_id: shopId,
            name,
            description,
            is_active: true
          })

        if (insertError) throw insertError

        setSuccess('Category created successfully.')
      }

      closeForm()
      await loadCategories()
    } catch (err) {
      if (err.code === '23505') {
        setError('A category with this name already exists.')
      } else {
        setError(err.message || 'Unable to save category.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(category) {
    const action = category.is_active ? 'deactivate' : 'activate'

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${category.name}"?`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id)
        .eq('shop_id', shopId)

      if (updateError) throw updateError

      setSuccess(`Category ${action}d successfully.`)
      await loadCategories()
    } catch (err) {
      setError(err.message || 'Unable to update category status.')
    }
  }

  const filteredCategories = categories.filter(category =>
    `${category.name} ${category.description || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const activeCount = categories.filter(c => c.is_active).length
  const inactiveCount = categories.length - activeCount

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Product Categories
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Organise your products into manageable categories.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Category
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Categories</p>
          <h2 className="mt-2 text-2xl font-bold">{categories.length}</h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Active Categories</p>
          <h2 className="mt-2 text-2xl font-bold text-green-600">
            {activeCount}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Inactive Categories</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-500">
            {inactiveCount}
          </h2>
        </div>
      </div>

      {/* Search and table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            onClick={loadCategories}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading categories...
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center">
            <Tags className="mx-auto mb-3 text-slate-300" size={36} />
            <h3 className="font-semibold text-slate-800">
              No categories found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Add a category or try another search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map(category => (
                  <tr key={category.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {category.name}
                    </td>

                    <td className="max-w-xs px-5 py-4 text-slate-500">
                      {category.description || 'No description'}
                    </td>

                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        category.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditForm(category)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          title="Edit category"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => toggleStatus(category)}
                          className={`rounded-lg p-2 ${
                            category.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={category.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Category' : 'Add New Category'}
                </h2>
                <p className="text-xs text-slate-500">
                  Enter the category details below.
                </p>
              </div>

              <button
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Category Name *
                </label>

                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={e =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="e.g. Beverages"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={e =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Brief description of this category..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
