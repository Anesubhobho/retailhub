
import { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Power,
  Truck,
  X,
  RefreshCw,
  Phone,
  Mail,
  MapPin
} from 'lucide-react'
import { supabase } from '../../services/supabase'

const emptyForm = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [shopId, setShopId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  async function loadSuppliers() {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) throw new Error('You must be logged in.')

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

      const { data, error: supplierError } = await supabase
        .from('suppliers')
        .select(`
          id,
          name,
          contact_person,
          phone,
          email,
          address,
          notes,
          is_active,
          created_at
        `)
        .eq('shop_id', profile.shop_id)
        .order('name', { ascending: true })

      if (supplierError) throw supplierError

      setSuppliers(data || [])
    } catch (err) {
      setError(err.message || 'Unable to load suppliers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  function openAddForm() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  function openEditForm(supplier) {
    setEditingId(supplier.id)

    setForm({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const name = form.name.trim()

    if (!name) {
      setError('Supplier name is required.')
      return
    }

    if (!shopId) {
      setError('Shop information is unavailable. Refresh the page.')
      return
    }

    setSaving(true)

    try {
      const supplierData = {
        name,
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', editingId)
          .eq('shop_id', shopId)

        if (updateError) throw updateError

        setSuccess('Supplier updated successfully.')
      } else {
        const { error: insertError } = await supabase
          .from('suppliers')
          .insert({
            ...supplierData,
            shop_id: shopId,
            is_active: true
          })

        if (insertError) throw insertError

        setSuccess('Supplier registered successfully.')
      }

      closeForm()
      await loadSuppliers()
    } catch (err) {
      setError(err.message || 'Unable to save supplier.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(supplier) {
    const action = supplier.is_active ? 'deactivate' : 'activate'

    if (!window.confirm(
      `Are you sure you want to ${action} "${supplier.name}"?`
    )) return

    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ is_active: !supplier.is_active })
        .eq('id', supplier.id)
        .eq('shop_id', shopId)

      if (updateError) throw updateError

      setSuccess(`Supplier ${action}d successfully.`)
      await loadSuppliers()
    } catch (err) {
      setError(err.message || 'Unable to change supplier status.')
    }
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    [
      supplier.name,
      supplier.contact_person,
      supplier.phone,
      supplier.email
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const activeCount = suppliers.filter(s => s.is_active).length
  const inactiveCount = suppliers.length - activeCount

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Supplier Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your suppliers and their contact information.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Supplier
        </button>
      </div>

      {/* Messages */}
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

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Suppliers</p>
          <h2 className="mt-2 text-2xl font-bold">{suppliers.length}</h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Active Suppliers</p>
          <h2 className="mt-2 text-2xl font-bold text-green-600">
            {activeCount}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Inactive Suppliers</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-500">
            {inactiveCount}
          </h2>
        </div>
      </div>

      {/* Supplier table */}
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
              placeholder="Search suppliers..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={loadSuppliers}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="mx-auto mb-3 text-slate-300" size={36} />
            <h3 className="font-semibold text-slate-800">
              No suppliers found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Add a supplier or try another search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Phone / Email</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">
                        {supplier.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {supplier.address || 'No address'}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {supplier.contact_person || 'Not provided'}
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-1 text-slate-600">
                        <p className="flex items-center gap-2">
                          <Phone size={13} />
                          {supplier.phone || 'Not provided'}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail size={13} />
                          {supplier.email || 'Not provided'}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        supplier.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditForm(supplier)}
                          title="Edit supplier"
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => toggleStatus(supplier)}
                          title={supplier.is_active ? 'Deactivate' : 'Activate'}
                          className={`rounded-lg p-2 ${
                            supplier.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
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

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-xl rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Supplier' : 'Register Supplier'}
                </h2>
                <p className="text-xs text-slate-500">
                  Supplier contact and business information.
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
                  Supplier / Company Name *
                </label>
                <input
                  required
                  maxLength={150}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. ABC Wholesale"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Contact Person
                </label>
                <input
                  maxLength={150}
                  value={form.contact_person}
                  onChange={e => setForm({ ...form, contact_person: e.target.value })}
                  placeholder="Contact person's name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    maxLength={30}
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+263..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    maxLength={150}
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="supplier@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Physical Address
                </label>
                <input
                  maxLength={300}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Supplier business address"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional supplier information..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

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
                      : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
