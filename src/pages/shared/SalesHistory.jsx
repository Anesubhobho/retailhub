
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

import {
  Search,
  RefreshCw,
  Receipt,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Banknote,
  ShoppingBag,
  XCircle,
  AlertTriangle,
  CheckCircle,
  Ban
} from 'lucide-react'

const money = value =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value) || 0)

const formatDate = value =>
  new Date(value).toLocaleString()

export default function SalesHistory() {
  const { profile } = useAuth()

  const [sales, setSales] = useState([])
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [expandedSale, setExpandedSale] = useState(null)

  const [cancellingSale, setCancellingSale] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelSuccess, setCancelSuccess] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const cancelOperationRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isOwner = profile?.role === 'owner'

  // ---------------------------------------
  // LOAD SALES
  // ---------------------------------------

  const loadSales = useCallback(async () => {
    if (!profile?.shop_id || !profile?.id) return

    setLoading(true)
    setError('')

    try {
      let query = supabase
        .from('sales')
        .select(`
          id,
          shop_id,
          receipt_number,
          sold_by,
          subtotal,
          total_amount,
          status,
          created_at,
          cancelled_at,
          cancelled_by,
          cancellation_reason
        `)
        .eq('shop_id', profile.shop_id)
        .order('created_at', { ascending: false })

      if (!isOwner) {
        query = query.eq('sold_by', profile.id)
      }

      const { data: salesData, error: salesError } = await query

      if (salesError) throw salesError

      const saleIds = (salesData || []).map(sale => sale.id)

      if (saleIds.length === 0) {
        setSales([])
        return
      }

      const [itemsResult, paymentsResult] = await Promise.all([
        supabase
          .from('sale_items')
          .select(`
            id,
            sale_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total
          `)
          .eq('shop_id', profile.shop_id)
          .in('sale_id', saleIds),

        supabase
          .from('sale_payments')
          .select(`
            id,
            sale_id,
            payment_method,
            amount_due,
            amount_tendered,
            change_due,
            payment_status
          `)
          .eq('shop_id', profile.shop_id)
          .in('sale_id', saleIds)
      ])

      if (itemsResult.error) throw itemsResult.error
      if (paymentsResult.error) throw paymentsResult.error

      const completeSales = (salesData || []).map(sale => ({
        ...sale,
        items: (itemsResult.data || []).filter(
          item => item.sale_id === sale.id
        ),
        payment: (paymentsResult.data || []).find(
          payment => payment.sale_id === sale.id
        ) || null
      }))

      setSales(completeSales)

    } catch (err) {
      console.error('Sales history error:', err)
      setError(err.message || 'Unable to load sales history.')
    } finally {
      setLoading(false)
    }
  }, [profile?.shop_id, profile?.id, isOwner])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  // ---------------------------------------
  // SEARCH AND FILTER
  // ---------------------------------------

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase()

    return sales.filter(sale => {
      const matchesSearch =
        !term ||
        sale.receipt_number?.toLowerCase().includes(term) ||
        sale.items.some(item =>
          item.product_name?.toLowerCase().includes(term)
        )

      const saleDate = new Date(sale.created_at)
        .toLocaleDateString('en-CA')

      const matchesDate =
        !dateFilter || saleDate === dateFilter

      return matchesSearch && matchesDate
    })
  }, [sales, search, dateFilter])

  // ---------------------------------------
  // SUMMARY
  // ---------------------------------------

  const completedSales = filteredSales.filter(
    sale => sale.status === 'completed'
  )

  const cancelledSales = filteredSales.filter(
    sale => sale.status === 'cancelled'
  )

  const totalRevenue = completedSales.reduce(
    (total, sale) => total + Number(sale.total_amount || 0),
    0
  )

  // ---------------------------------------
  // OPEN CANCELLATION MODAL
  // ---------------------------------------

  function openCancellation(sale) {
    setCancellingSale(sale)
    setCancelReason('')
    setCancelError('')
    setCancelSuccess('')

    cancelOperationRef.current = {
      saleId: sale.id,
      operationId: crypto.randomUUID()
    }
  }

  function closeCancellation() {
    if (cancelling) return

    setCancellingSale(null)
    setCancelReason('')
    setCancelError('')
    cancelOperationRef.current = null
  }

  // ---------------------------------------
  // CONFIRM CANCELLATION
  // ---------------------------------------

  async function confirmCancellation() {
    if (cancelling || !cancellingSale) return

    const reason = cancelReason.trim()

    if (reason.length < 5) {
      setCancelError(
        'Please provide a reason of at least 5 characters.'
      )
      return
    }

    if (!cancelOperationRef.current) {
      cancelOperationRef.current = {
        saleId: cancellingSale.id,
        operationId: crypto.randomUUID()
      }
    }

    setCancelling(true)
    setCancelError('')

    try {
      const { data, error } = await supabase.rpc('cancel_sale', {
        p_sale_id: cancellingSale.id,
        p_reason: reason,
        p_client_operation_id:
          cancelOperationRef.current.operationId
      })

      if (error) throw error

      if (!data?.success) {
        throw new Error(
          data?.message || 'Cancellation could not be completed.'
        )
      }

      setCancelSuccess(
        data.duplicate
          ? 'This cancellation was already processed.'
          : 'Sale cancelled and stock restored successfully.'
      )

      setCancellingSale(null)
      setCancelReason('')
      cancelOperationRef.current = null

      await loadSales()

    } catch (err) {
      console.error('Sale cancellation error:', err)

      setCancelError(
        err.message ||
        'Unable to cancel this sale. Please try again.'
      )

      // Keep the operation ID so that an uncertain request
      // can be retried without creating a duplicate operation.
    } finally {
      setCancelling(false)
    }
  }

  // ---------------------------------------
  // PAGE
  // ---------------------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Sales History
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {isOwner
              ? 'Review and manage all shop transactions.'
              : 'Review and manage your own transactions.'}
          </p>
        </div>

        <button
          onClick={loadSales}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* SUCCESS MESSAGE */}

      {cancelSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle size={19} />
          {cancelSuccess}
        </div>
      )}

      {/* ERROR MESSAGE */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Completed Sales
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? '...' : completedSales.length}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Cancelled Sales
          </p>
          <h2 className="mt-2 text-2xl font-bold text-red-600">
            {loading ? '...' : cancelledSales.length}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Completed Sales Value
          </p>
          <h2 className="mt-2 text-2xl font-bold text-green-600">
            {loading ? '...' : money(totalRevenue)}
          </h2>
        </div>
      </div>

      {/* SEARCH AND DATE FILTER */}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search receipt number or product..."
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="relative">
          <CalendarDays
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="date"
            value={dateFilter}
            onChange={event => setDateFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
          >
            Clear date
          </button>
        )}
      </div>

      {/* TRANSACTIONS */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900">
            Transactions
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {filteredSales.length} transaction(s) found
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading sales history...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-10 text-center">
            <Receipt
              size={38}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 font-medium text-slate-800">
              No transactions found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or date filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSales.map(sale => {
              const expanded = expandedSale === sale.id
              const isCancelled = sale.status === 'cancelled'

              return (
                <div key={sale.id}>

                  {/* SALE ROW */}

                  <div className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-slate-50">

                    <button
                      onClick={() =>
                        setExpandedSale(expanded ? null : sale.id)
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
                        <Receipt size={21} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {sale.receipt_number}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(sale.created_at)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {sale.items.length} product line(s)
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {money(sale.total_amount)}
                        </p>

                        <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isCancelled
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {isCancelled ? 'Cancelled' : 'Completed'}
                        </span>
                      </div>

                      <button
                        onClick={() =>
                          setExpandedSale(expanded ? null : sale.id)
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                        aria-label="Toggle transaction details"
                      >
                        {expanded
                          ? <ChevronUp size={19} />
                          : <ChevronDown size={19} />
                        }
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS */}

                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-5">

                      <div className="mb-4 flex items-center gap-2">
                        <ShoppingBag
                          size={18}
                          className="text-blue-600"
                        />
                        <h3 className="font-semibold text-slate-800">
                          Purchased Products
                        </h3>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-100 text-xs text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Product</th>
                              <th className="px-4 py-3 text-right">Qty</th>
                              <th className="px-4 py-3 text-right">Unit Price</th>
                              <th className="px-4 py-3 text-right">Subtotal</th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {sale.items.map(item => (
                              <tr key={item.id}>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  {item.product_name}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {money(item.unit_price)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold">
                                  {money(item.line_total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

                        {/* PAYMENT */}

                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2">
                            <Banknote
                              size={18}
                              className="text-green-600"
                            />
                            <h3 className="font-semibold text-slate-800">
                              Payment Information
                            </h3>
                          </div>

                          {sale.payment ? (
                            <div className="mt-3 space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Method</span>
                                <span className="font-medium">
                                  {sale.payment.payment_method.toUpperCase()}
                                </span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-slate-500">Amount due</span>
                                <span>{money(sale.payment.amount_due)}</span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-slate-500">Tendered</span>
                                <span>{money(sale.payment.amount_tendered)}</span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-slate-500">Change</span>
                                <span>{money(sale.payment.change_due)}</span>
                              </div>

                              <div className="flex justify-between">
                                <span className="text-slate-500">Payment status</span>
                                <span className={`font-semibold ${
                                  sale.payment.payment_status === 'completed'
                                    ? 'text-green-700'
                                    : 'text-red-700'
                                }`}>
                                  {sale.payment.payment_status}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">
                              No payment record found.
                            </p>
                          )}
                        </div>

                        {/* TRANSACTION INFORMATION */}

                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <h3 className="font-semibold text-slate-800">
                            Transaction Information
                          </h3>

                          <div className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between gap-3">
                              <span className="text-slate-500">Receipt</span>
                              <span className="break-all text-right font-medium">
                                {sale.receipt_number}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-500">Status</span>
                              <span className="font-medium capitalize">
                                {sale.status}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-500">Created</span>
                              <span className="text-right">
                                {formatDate(sale.created_at)}
                              </span>
                            </div>

                            {sale.cancelled_at && (
                              <div className="flex justify-between gap-3">
                                <span className="text-slate-500">
                                  Cancelled
                                </span>
                                <span className="text-right">
                                  {formatDate(sale.cancelled_at)}
                                </span>
                              </div>
                            )}

                            {sale.cancellation_reason && (
                              <div className="border-t pt-3">
                                <p className="text-xs font-semibold text-red-700">
                                  Cancellation reason
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                  {sale.cancellation_reason}
                                </p>
                              </div>
                            )}

                            <div className="flex justify-between border-t pt-3 font-bold">
                              <span>Total</span>
                              <span>{money(sale.total_amount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CANCELLATION ACTION */}

                      {!isCancelled && (
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-100 bg-white p-4">
                          <div>
                            <p className="font-semibold text-slate-800">
                              Cancel this transaction?
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Stock will be restored and the payment marked voided.
                            </p>
                          </div>

                          <button
                            onClick={() => openCancellation(sale)}
                            className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                          >
                            <Ban size={17} />
                            Cancel Sale
                          </button>
                        </div>
                      )}

                      {isCancelled && (
                        <div className="mt-5 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                          <XCircle size={18} />
                          This transaction has been cancelled.
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CANCELLATION MODAL */}

      {cancellingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    size={22}
                    className="text-red-600"
                  />
                  <h2 className="text-xl font-bold text-slate-900">
                    Cancel Sale
                  </h2>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Receipt: {cancellingSale.receipt_number}
                </p>
              </div>

              <button
                onClick={closeCancellation}
                disabled={cancelling}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Close cancellation dialog"
              >
                <XCircle size={21} />
              </button>
            </div>

            <div className="mt-5 rounded-lg bg-red-50 p-4">
              <p className="text-sm text-red-800">
                You are about to cancel a sale worth{' '}
                <strong>{money(cancellingSale.total_amount)}</strong>.
                The original transaction will be preserved and its stock
                quantities will be restored.
              </p>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Reason for cancellation
              <span className="text-red-600"> *</span>
            </label>

            <textarea
              rows={4}
              value={cancelReason}
              disabled={cancelling}
              onChange={event => {
                setCancelReason(event.target.value)
                setCancelError('')
              }}
              placeholder="Explain why this transaction is being cancelled..."
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />

            <p className="mt-1 text-xs text-slate-500">
              Minimum 5 characters.
            </p>

            {cancelError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {cancelError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={closeCancellation}
                disabled={cancelling}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Go Back
              </button>

              <button
                onClick={confirmCancellation}
                disabled={cancelling || cancelReason.trim().length < 5}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {cancelling ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Ban size={16} />
                    Confirm Cancellation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
