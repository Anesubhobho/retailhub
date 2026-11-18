
import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Search, Pencil, Power, Package, X, RefreshCw
} from 'lucide-react'
import { supabase } from '../../services/supabase'

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  description: '',
  category_id: '',
  supplier_id: '',
  cost_price: '',
  selling_price: '',
  reorder_level: '5'
}

const money = value =>
  Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  })

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [shopId, setShopId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    loadPage()
  }, [])

  async function loadPage() {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) throw new Error('Please sign in again.')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('shop_id, role, is_active')
        .eq('id', authData.user.id)
        .single()

      if (profileError) throw profileError
      if (!profile?.is_active || profile.role !== 'owner') {
        throw new Error('Only the shop owner can manage products.')
      }

      setShopId(profile.shop_id)

      const [productResult, categoryResult, supplierResult] =
        await Promise.all([
          supabase
            .from('products')
            .select('*')
            .eq('shop_id', profile.shop_id)
            .order('name'),
          supabase
            .from('categories')
            .select('id, name, is_active')
            .eq('shop_id', profile.shop_id)
            .order('name'),
          supabase
            .from('suppliers')
            .select('id, name, is_active')
            .eq('shop_id', profile.shop_id)
            .order('name')
        ])

      if (productResult.error) throw productResult.error
      if (categoryResult.error) throw categoryResult.error
      if (supplierResult.error) throw supplierResult.error

      setProducts(productResult.data || [])
      setCategories(categoryResult.data || [])
      setSuppliers(supplierResult.data || [])
    } catch (err) {
      setError(err.message || 'Could not load products.')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()

    return products.filter(product => {
      const matchesSearch =
        !term ||
        product.name?.toLowerCase().includes(term) ||
        product.sku?.toLowerCase().includes(term) ||
        product.barcode?.toLowerCase().includes(term)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active)

      return matchesSearch && matchesStatus
    })
  }, [products, search, statusFilter])

  function openAddModal() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setSuccess('')
    setModalOpen(true)
  }

  function openEditModal(product) {
    setEditingId(product.id)
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      description: product.description || '',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      cost_price: String(product.cost_price ?? ''),
      selling_price: String(product.selling_price ?? ''),
      reorder_level: String(product.reorder_level ?? 5)
    })
    setError('')
    setSuccess('')
    setModalOpen(true)
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.name.trim()) {
      setError('Product name is required.')
      return
    }

    const cost = Number(form.cost_price)
    const selling = Number(form.selling_price)
    const reorder = Number(form.reorder_level)

    if (
      form.cost_price === '' ||
      form.selling_price === '' ||
      !Number.isFinite(cost) ||
      !Number.isFinite(selling) ||
      cost < 0 ||
      selling < 0
    ) {
      setError('Enter valid, non-negative cost and selling prices.')
      return
    }

    if (
      form.reorder_level === '' ||
      !Number.isInteger(reorder) ||
      reorder < 0
    ) {
      setError('Reorder level must be a whole number of zero or more.')
      return
    }

    setSaving(true)

    const payload = {
      shop_id: shopId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      cost_price: cost,
      selling_price: selling,
      reorder_level: reorder
    }

    try {
      let result

      if (editingId) {
        result = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingId)
          .eq('shop_id', shopId)
      } else {
        result = await supabase
          .from('products')
          .insert(payload)
      }

      if (result.error) throw result.error

      setSuccess(editingId ? 'Product updated.' : 'Product added.')
      setModalOpen(false)
      setForm(emptyForm)
      setEditingId(null)
      await loadPage()
    } catch (err) {
      if (err.code === '23505') {
        setError('That SKU or barcode is already in use in this shop.')
      } else {
        setError(err.message || 'Could not save product.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(product) {
    const action = product.is_active ? 'deactivate' : 'reactivate'

    if (!window.confirm(`Are you sure you want to ${action} this product?`)) {
      return
    }

    setError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id)
      .eq('shop_id', shopId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(`Product ${action}d successfully.`)
    await loadPage()
  }

  const activeCount = products.filter(p => p.is_active).length
  const inactiveCount = products.length - activeCount

  function categoryName(id) {
    return categories.find(item => item.id === id)?.name || 'Uncategorised'
  }

  function supplierName(id) {
    return suppliers.find(item => item.id === id)?.name || 'Not assigned'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your shop's products, prices and reorder levels.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} /> Add Product
        </button>
      </div>

      {error && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total products</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{products.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Active products</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Inactive products</p>
          <p className="mt-2 text-2xl font-bold text-slate-500">{inactiveCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by product name, SKU or barcode..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="active">Active products</option>
            <option value="inactive">Inactive products</option>
            <option value="all">All products</option>
          </select>

          <button
            onClick={loadPage}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading products...
            </p>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto text-slate-300" size={36} />
              <p className="mt-3 font-medium text-slate-700">No products found</p>
              <p className="mt-1 text-sm text-slate-500">
                Add a product or change your search.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">SKU / Barcode</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3">Cost price</th>
                  <th className="px-3 py-3">Selling price</th>
                  <th className="px-3 py-3">Reorder level</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-900">{product.name}</p>
                      {product.description && (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">
                          {product.description}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      <p>{product.sku || '—'}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {product.barcode || 'No barcode'}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      {categoryName(product.category_id)}
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      {supplierName(product.supplier_id)}
                    </td>
                    <td className="px-3 py-4">{money(product.cost_price)}</td>
                    <td className="px-3 py-4 font-semibold">
                      {money(product.selling_price)}
                    </td>
                    <td className="px-3 py-4">{product.reorder_level}</td>
                    <td className="px-3 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        product.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(product)}
                          title="Edit product"
                          className="rounded-lg border border-slate-200 p-2 text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => toggleStatus(product)}
                          title={product.is_active ? 'Deactivate' : 'Reactivate'}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Product' : 'Add Product'}
                </h2>
                <p className="text-sm text-slate-500">
                  Enter product details and pricing.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Product name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    required
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"
                    placeholder="e.g. 2L Cooking Oil"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  SKU
                  <input
                    name="sku"
                    value={form.sku}
                    onChange={updateField}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"
                    placeholder="e.g. OIL-002"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Barcode
                  <input
                    name="barcode"
                    value={form.barcode}
                    onChange={updateField}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"
                    placeholder="Scan or enter barcode"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Category
                  <select
                    name="category_id"
                    value={form.category_id}
                    onChange={updateField}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  >
                    <option value="">No category</option>
                    {categories
                      .filter(c => c.is_active || c.id === form.category_id)
                      .map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Supplier
                  <select
                    name="supplier_id"
                    value={form.supplier_id}
                    onChange={updateField}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  >
                    <option value="">No supplier</option>
                    {suppliers
                      .filter(s => s.is_active || s.id === form.supplier_id)
                      .map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Cost price (USD) *
                  <input
                    type="number"
                    name="cost_price"
                    value={form.cost_price}
                    onChange={updateField}
                    min="0"
                    step="0.01"
                    required
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    placeholder="0.00"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Selling price (USD) *
                  <input
                    type="number"
                    name="selling_price"
                    value={form.selling_price}
                    onChange={updateField}
                    min="0"
                    step="0.01"
                    required
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    placeholder="0.00"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Reorder level *
                  <input
                    type="number"
                    name="reorder_level"
                    value={form.reorder_level}
                    onChange={updateField}
                    min="0"
                    step="1"
                    required
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    placeholder="5"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  rows="3"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"
                  placeholder="Optional product description..."
                />
              </label>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                Stock quantity is not entered here. It will be calculated
                automatically from stock receiving, sales and adjustments.
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
