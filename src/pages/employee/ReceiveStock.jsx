
import { useEffect, useState } from 'react'
import {
  PackagePlus,
  RefreshCw,
  ClipboardList,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { supabase } from '../../services/supabase'

const initialForm = {
  product_id: '',
  supplier_id: '',
  quantity: '1',
  reference: '',
  notes: ''
}

function formatDate(value) {
  return new Date(value).toLocaleString()
}

export default function ReceiveStock() {
  const [shopId, setShopId] = useState(null)
  const [userId, setUserId] = useState(null)

  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [movements, setMovements] = useState([])

  const [form, setForm] = useState(initialForm)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      if (!authData.user) {
        throw new Error('Please sign in again.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('shop_id, role, is_active')
        .eq('id', authData.user.id)
        .single()

      if (profileError) throw profileError

      if (
        !profile?.is_active ||
        !['owner', 'employee'].includes(profile.role)
      ) {
        throw new Error('You are not authorised to receive stock.')
      }

      setShopId(profile.shop_id)
      setUserId(authData.user.id)

      const [
        productResult,
        supplierResult,
        movementResult
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku')
          .eq('shop_id', profile.shop_id)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('suppliers')
          .select('id, name')
          .eq('shop_id', profile.shop_id)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('stock_movements')
          .select(`
            id,
            product_id,
            supplier_id,
            quantity_delta,
            notes,
            created_at
          `)
          .eq('shop_id', profile.shop_id)
          .eq('movement_type', 'received')
          .order('created_at', { ascending: false })
          .limit(10)
      ])

      if (productResult.error) throw productResult.error
      if (supplierResult.error) throw supplierResult.error
      if (movementResult.error) throw movementResult.error

      setProducts(productResult.data || [])
      setSuppliers(supplierResult.data || [])
      setMovements(movementResult.data || [])
    } catch (err) {
      setError(err.message || 'Could not load stock receiving data.')
    } finally {
      setLoading(false)
    }
  }

  function updateField(event) {
    const { name, value } = event.target

    setForm(current => ({
      ...current,
      [name]: value
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setSuccess('')

    const quantity = Number(form.quantity)

    if (!form.product_id) {
      setError('Please select a product.')
      return
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isInteger(quantity)
    ) {
      setError('Enter a valid whole-number quantity greater than zero.')
      return
    }

    if (!shopId || !userId) {
      setError('Your session information is missing. Please sign in again.')
      return
    }

    setSaving(true)

    const referenceText = form.reference.trim()
      ? `Reference: ${form.reference.trim()}`
      : ''

    const notes = [
      referenceText,
      form.notes.trim()
    ].filter(Boolean).join(' | ') || null

    try {
      const { error: insertError } = await supabase
        .from('stock_movements')
        .insert({
          shop_id: shopId,
          product_id: form.product_id,
          supplier_id: form.supplier_id || null,
          movement_type: 'received',
          quantity_delta: quantity,
          notes,
          created_by: userId,
          client_operation_id: crypto.randomUUID()
        })

      if (insertError) throw insertError

      const receivedProduct = products.find(
        product => product.id === form.product_id
      )

      setSuccess(
        `${quantity} unit(s) of ${receivedProduct?.name || 'the selected product'} received successfully.`
      )

      setForm(initialForm)

      await loadPage()
    } catch (err) {
      if (err.code === '23505') {
        setError(
          'This receiving operation may already have been recorded. Refresh the page and check the history.'
        )
      } else {
        setError(err.message || 'Could not record stock receipt.')
      }
    } finally {
      setSaving(false)
    }
  }

  function productName(productId) {
    return products.find(
      product => product.id === productId
    )?.name || 'Product'
  }

  function supplierName(supplierId) {
    return suppliers.find(
      supplier => supplier.id === supplierId
    )?.name || 'Not recorded'
  }

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Receive Stock
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Record products delivered to your shop.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">

        {/* Receive stock form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">

          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
              <PackagePlus size={22} />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                New stock receipt
              </h2>

              <p className="text-xs text-slate-500">
                Enter the products and quantities received.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading products and suppliers...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Product */}
              <label className="block text-sm font-medium text-slate-700">
                Product *

                <select
                  name="product_id"
                  value={form.product_id}
                  onChange={updateField}
                  required
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                >
                  <option value="">
                    Select a product
                  </option>

                  {products.map(product => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {/* Supplier */}
              <label className="block text-sm font-medium text-slate-700">
                Supplier

                <select
                  name="supplier_id"
                  value={form.supplier_id}
                  onChange={updateField}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                >
                  <option value="">
                    Select supplier (optional)
                  </option>

                  {suppliers.map(supplier => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Quantity */}
              <label className="block text-sm font-medium text-slate-700">
                Quantity received *

                <input
                  type="number"
                  name="quantity"
                  value={form.quantity}
                  onChange={updateField}
                  min="1"
                  step="1"
                  required
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  placeholder="Enter quantity"
                />
              </label>

              {/* Invoice reference */}
              <label className="block text-sm font-medium text-slate-700">
                Invoice / delivery reference

                <input
                  type="text"
                  name="reference"
                  value={form.reference}
                  onChange={updateField}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  placeholder="e.g. INV-2026-001"
                />
              </label>

              {/* Notes */}
              <label className="block text-sm font-medium text-slate-700">
                Notes

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={updateField}
                  rows="3"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  placeholder="Optional delivery notes..."
                />
              </label>

              {/* Information */}
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                Only product quantities are recorded here.
                Product prices are managed separately by the owner.
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={saving || products.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PackagePlus size={18} />

                {saving
                  ? 'Recording receipt...'
                  : 'Record Stock Receipt'}
              </button>

              {products.length === 0 && (
                <p className="text-center text-xs text-amber-700">
                  No active products are available.
                  Ask the owner to add products first.
                </p>
              )}

            </form>
          )}
        </div>

        {/* Recent receipts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">
              <ClipboardList
                className="text-blue-600"
                size={22}
              />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Recent receipts
                </h2>

                <p className="text-xs text-slate-500">
                  Latest 10 stock entries
                </p>
              </div>
            </div>

            <button
              onClick={loadPage}
              title="Refresh history"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
            </button>

          </div>

          <div className="mt-4 space-y-3">

            {movements.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No stock receipts recorded yet.
              </p>
            ) : (
              movements.map(movement => (
                <div
                  key={movement.id}
                  className="rounded-lg border border-slate-100 p-3"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div>
                      <p className="font-medium text-slate-800">
                        {productName(movement.product_id)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Supplier: {supplierName(movement.supplier_id)}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      +{movement.quantity_delta}
                    </span>

                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Received: {formatDate(movement.created_at)}
                  </div>

                  {movement.notes && (
                    <p className="mt-2 break-words text-xs text-slate-500">
                      {movement.notes}
                    </p>
                  )}

                </div>
              ))
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
