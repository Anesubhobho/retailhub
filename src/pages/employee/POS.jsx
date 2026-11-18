
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  RefreshCw,
  ArrowLeft,
  Banknote,
  CheckCircle,
  AlertTriangle,
  Printer,
  Receipt,
  XCircle
} from 'lucide-react'

const formatUSD = value =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value) || 0)

const toCents = value =>
  Math.round((Number(value) + Number.EPSILON) * 100)

export default function POS() {
  const { profile } = useAuth()

  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')

  const [step, setStep] = useState('cart')
  const [amountTendered, setAmountTendered] = useState('')

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [receiptData, setReceiptData] = useState(null)

  // Keep the same operation ID when retrying an uncertain checkout.
  const operationIdRef = useRef(null)
  const checkoutAttemptedRef = useRef(false)

  // ---------------------------------------
  // LOAD PRODUCTS AND STOCK
  // ---------------------------------------

  const loadProducts = useCallback(async () => {
    if (!profile?.shop_id) return

    setLoading(true)
    setError('')

    try {
      const [productsResult, stockResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, selling_price')
          .eq('shop_id', profile.shop_id)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('inventory_stock_balances')
          .select('product_id, available_stock')
          .eq('shop_id', profile.shop_id)
          .eq('is_active', true)
      ])

      if (productsResult.error) throw productsResult.error
      if (stockResult.error) throw stockResult.error

      const stockMap = new Map(
        (stockResult.data || []).map(item => [
          item.product_id,
          Number(item.available_stock || 0)
        ])
      )

      const updatedProducts = (productsResult.data || []).map(product => ({
        ...product,
        selling_price: Number(product.selling_price),
        available_stock: stockMap.get(product.id) || 0
      }))

      setProducts(updatedProducts)

      setCart(currentCart =>
        currentCart
          .map(item => {
            const latest = updatedProducts.find(
              product => product.id === item.id
            )

            if (!latest) return null

            return {
              ...item,
              available_stock: latest.available_stock,
              quantity: Math.min(
                item.quantity,
                latest.available_stock
              )
            }
          })
          .filter(item => item && item.quantity > 0)
      )
    } catch (err) {
      console.error('POS loading error:', err)
      setError(err.message || 'Unable to load products.')
    } finally {
      setLoading(false)
    }
  }, [profile?.shop_id])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // ---------------------------------------
  // CART CALCULATIONS
  // ---------------------------------------

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return products

    return products.filter(product =>
      product.name?.toLowerCase().includes(term) ||
      product.sku?.toLowerCase().includes(term)
    )
  }, [products, search])

  const cartTotal = useMemo(() => {
    return Math.round(
      cart.reduce(
        (total, item) =>
          total + toCents(item.selling_price) * item.quantity,
        0
      )
    )
  }, [cart])

  const totalItems = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const cartErrors = useMemo(() => {
    const errors = []

    if (cart.length === 0) {
      errors.push('Your cart is empty.')
      return errors
    }

    cart.forEach(item => {
      if (
        !Number.isFinite(item.selling_price) ||
        item.selling_price <= 0
      ) {
        errors.push(`${item.name}: Invalid selling price.`)
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push(`${item.name}: Invalid quantity.`)
      }

      if (item.quantity > item.available_stock) {
        errors.push(`${item.name}: Requested quantity exceeds available stock.`)
      }
    })

    return errors
  }, [cart])

  const tenderedCents =
    amountTendered.trim() === '' ||
    !Number.isFinite(Number(amountTendered))
      ? 0
      : toCents(amountTendered)

  const changeCents = Math.max(0, tenderedCents - cartTotal)

  const paymentValid =
    cartErrors.length === 0 &&
    tenderedCents >= cartTotal &&
    tenderedCents > 0

  // ---------------------------------------
  // ADD TO CART
  // ---------------------------------------

  function addToCart(product) {
    setError('')
    setNotice('')

    if (
      !Number.isFinite(product.selling_price) ||
      product.selling_price <= 0
    ) {
      setError(`${product.name} has an invalid selling price.`)
      return
    }

    if (product.available_stock <= 0) {
      setError(`${product.name} is out of stock.`)
      return
    }

    setCart(current => {
      const existing = current.find(item => item.id === product.id)

      if (existing) {
        if (existing.quantity >= product.available_stock) {
          setError(`Only ${product.available_stock} units are available.`)
          return current
        }

        return current.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          selling_price: product.selling_price,
          available_stock: product.available_stock,
          quantity: 1
        }
      ]
    })
  }

  // ---------------------------------------
  // CHANGE QUANTITY
  // ---------------------------------------

  function changeQuantity(productId, amount) {
    setError('')

    setCart(current =>
      current
        .map(item => {
          if (item.id !== productId) return item

          const quantity = item.quantity + amount

          if (quantity <= 0) return null

          if (quantity > item.available_stock) {
            setError(
              `Only ${item.available_stock} units of ${item.name} are available.`
            )
            return item
          }

          return { ...item, quantity }
        })
        .filter(Boolean)
    )
  }

  function removeFromCart(productId) {
    setCart(current => current.filter(item => item.id !== productId))
    setError('')
  }

  function clearCart() {
    setCart([])
    setError('')
    setNotice('')
  }

  // ---------------------------------------
  // OPEN PAYMENT SCREEN
  // ---------------------------------------

  function proceedToPayment() {
    setError('')
    setNotice('')

    if (cartErrors.length > 0) {
      setError(cartErrors.join(' '))
      return
    }

    setAmountTendered('')
    setStep('payment')
  }

  // ---------------------------------------
  // RETURN TO CART
  // ---------------------------------------

  function backToCart() {
    if (checkoutAttemptedRef.current) {
      setError(
        'Checkout has already been attempted. Retry the same payment to safely confirm its result.'
      )
      return
    }

    setStep('cart')
    setError('')
  }

  // ---------------------------------------
  // CONFIRM CASH PAYMENT
  // ---------------------------------------

  async function confirmPayment() {
    if (processing) return

    setError('')
    setNotice('')

    if (!profile?.shop_id || !profile?.id) {
      setError('Your employee session is unavailable. Please log in again.')
      return
    }

    if (cartErrors.length > 0) {
      setError(cartErrors.join(' '))
      return
    }

    if (tenderedCents < cartTotal) {
      setError('The amount tendered is less than the order total.')
      return
    }

    if (tenderedCents <= 0) {
      setError('Enter a valid cash amount.')
      return
    }

    // Generate once and retain for safe retry.
    if (!operationIdRef.current) {
      operationIdRef.current = crypto.randomUUID()
    }

    const operationId = operationIdRef.current

    const cartSnapshot = cart.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      selling_price: item.selling_price,
      quantity: item.quantity
    }))

    checkoutAttemptedRef.current = true
    setProcessing(true)

    try {
      const { data, error: checkoutError } = await supabase.rpc(
        'checkout_cash',
        {
          p_items: cartSnapshot.map(item => ({
            product_id: item.id,
            quantity: item.quantity
          })),
          p_amount_tendered: Number(amountTendered),
          p_client_operation_id: operationId
        }
      )

      if (checkoutError) throw checkoutError

      if (!data?.success || !data?.sale_id) {
        throw new Error(
          data?.message || 'Payment could not be confirmed.'
        )
      }

      const receipt = {
        ...data,
        items: cartSnapshot,
        employee: profile.full_name || 'Employee',
        date: new Date().toISOString()
      }

      setReceiptData(receipt)
      setCart([])
      setAmountTendered('')
      setStep('receipt')

      // The successful checkout has consumed this operation ID.
      operationIdRef.current = null
      checkoutAttemptedRef.current = false

      // Refresh stock in the background.
      loadProducts()
    } catch (err) {
      console.error('Cash checkout error:', err)

      setError(
        err.message ||
        'Payment could not be confirmed. Retry the same checkout before starting another sale.'
      )
    } finally {
      setProcessing(false)
    }
  }

  // ---------------------------------------
  // START A NEW SALE
  // ---------------------------------------

  function startNewSale() {
    setReceiptData(null)
    setCart([])
    setSearch('')
    setAmountTendered('')
    setError('')
    setNotice('')
    setStep('cart')
    operationIdRef.current = null
    checkoutAttemptedRef.current = false
    loadProducts()
  }

  // ---------------------------------------
  // PRINT RECEIPT
  // ---------------------------------------

  function printReceipt() {
    window.print()
  }

  // ---------------------------------------
  // RECEIPT SCREEN
  // ---------------------------------------

  if (step === 'receipt' && receiptData) {
    return (
      <div className="space-y-5">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Payment Successful
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              The sale has been recorded and stock has been deducted.
            </p>
          </div>

          <CheckCircle size={34} className="text-green-600" />
        </div>

        <div className="print-area mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <Receipt size={35} className="mx-auto text-slate-700" />

            <h2 className="mt-3 text-xl font-bold text-slate-900">
              RETAILHUB
            </h2>

            <p className="text-sm text-slate-500">
              Sales Receipt
            </p>

            <div className="my-4 border-t border-dashed border-slate-300" />

            <p className="text-xs text-slate-500">
              Receipt Number
            </p>

            <p className="font-bold text-slate-900">
              {receiptData.receipt_number}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              {new Date(receiptData.date).toLocaleString()}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Served by: {receiptData.employee}
            </p>
          </div>

          <div className="my-5 border-t border-dashed border-slate-300" />

          <div className="space-y-3">
            {receiptData.items.map((item, index) => (
              <div key={`${item.id}-${index}`}>
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-slate-800">
                    {item.name}
                  </span>

                  <span className="font-medium text-slate-900">
                    {formatUSD(
                      item.selling_price * item.quantity
                    )}
                  </span>
                </div>

                <p className="text-xs text-slate-500">
                  {item.quantity} × {formatUSD(item.selling_price)}
                </p>
              </div>
            ))}
          </div>

          <div className="my-5 border-t border-dashed border-slate-300" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatUSD(receiptData.total_amount)}</span>
            </div>

            <div className="flex justify-between">
              <span>Payment method</span>
              <span>Cash</span>
            </div>

            <div className="flex justify-between">
              <span>Amount tendered</span>
              <span>{formatUSD(receiptData.amount_tendered)}</span>
            </div>

            <div className="flex justify-between font-bold text-slate-900">
              <span>Change</span>
              <span>{formatUSD(receiptData.change_due)}</span>
            </div>
          </div>

          <div className="my-5 border-t border-dashed border-slate-300" />

          <div className="text-center">
            <p className="font-semibold text-slate-900">
              Thank you for shopping with us!
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Please keep this receipt.
            </p>
          </div>
        </div>

        <div className="no-print flex flex-wrap justify-center gap-3">
          <button
            onClick={printReceipt}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer size={18} />
            Print Receipt
          </button>

          <button
            onClick={startNewSale}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={18} />
            New Sale
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------
  // PAYMENT SCREEN
  // ---------------------------------------

  if (step === 'payment') {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={backToCart}
            disabled={processing || checkoutAttemptedRef.current}
            className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Back to cart"
          >
            <ArrowLeft size={19} />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Cash Payment
            </h1>
            <p className="text-sm text-slate-500">
              Receive cash and confirm the customer payment.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle size={19} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-3 text-green-700">
              <Banknote size={25} />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Cash
              </h2>
              <p className="text-xs text-slate-500">
                Payment method
              </p>
            </div>

            <span className="ml-auto rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Selected
            </span>
          </div>

          <div className="my-6 rounded-xl bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-500">
              Total Amount Due
            </p>

            <h2 className="mt-2 text-4xl font-bold text-slate-900">
              {formatUSD(cartTotal / 100)}
            </h2>

            <p className="mt-2 text-xs text-slate-500">
              {totalItems} item(s)
            </p>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Amount Tendered (USD)
          </label>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-500">
              $
            </span>

            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Enter cash received"
              value={amountTendered}
              disabled={processing || checkoutAttemptedRef.current}
              onChange={event => {
                setAmountTendered(event.target.value)
                setError('')
              }}
              className="w-full rounded-xl border border-slate-300 py-4 pl-9 pr-4 text-xl font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[10, 20, 50, 100].map(amount => (
              <button
                key={amount}
                onClick={() => {
                  setAmountTendered(String(amount))
                  setError('')
                }}
                disabled={processing || checkoutAttemptedRef.current}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                ${amount}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Amount due</span>
              <span className="font-semibold">
                {formatUSD(cartTotal / 100)}
              </span>
            </div>

            <div className="mt-3 flex justify-between text-sm">
              <span className="text-slate-500">Cash received</span>
              <span className="font-semibold">
                {formatUSD(tenderedCents / 100)}
              </span>
            </div>

            <div className="my-4 border-t border-slate-200" />

            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                Change Due
              </span>

              <span className={`text-2xl font-bold ${
                paymentValid ? 'text-green-600' : 'text-slate-400'
              }`}>
                {formatUSD(changeCents / 100)}
              </span>
            </div>
          </div>

          {amountTendered !== '' && tenderedCents < cartTotal && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <XCircle size={18} />
              Insufficient cash. The customer still owes{' '}
              {formatUSD((cartTotal - tenderedCents) / 100)}.
            </div>
          )}

          {paymentValid && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle size={18} />
              Payment amount is sufficient.
            </div>
          )}

          <button
            onClick={confirmPayment}
            disabled={!paymentValid || processing}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-4 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {processing ? (
              <>
                <RefreshCw size={19} className="animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <CheckCircle size={19} />
                Confirm Cash Payment
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Confirming records the sale and deducts stock from inventory.
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------
  // PRODUCT AND CART SCREEN
  // ---------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Point of Sale
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select products and create a customer order.
          </p>
        </div>

        <button
          onClick={loadProducts}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh Stock
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* PRODUCTS */}

        <section className="space-y-4 xl:col-span-2">
          <div className="relative">
            <Search
              size={19}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search products by name or SKU..."
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {loading ? (
            <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center">
              <Package size={35} className="mx-auto text-slate-300" />
              <p className="mt-3 font-medium text-slate-800">
                No products found
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map(product => {
                const unavailable = product.available_stock <= 0
                const invalidPrice =
                  !Number.isFinite(product.selling_price) ||
                  product.selling_price <= 0

                const cartItem = cart.find(
                  item => item.id === product.id
                )

                const limitReached =
                  cartItem &&
                  cartItem.quantity >= product.available_stock

                return (
                  <div
                    key={product.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Package size={21} />
                    </div>

                    <h3 className="mt-3 font-semibold text-slate-900">
                      {product.name}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      SKU: {product.sku || 'Not assigned'}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {formatUSD(product.selling_price)}
                      </span>

                      <span className={`text-xs font-medium ${
                        unavailable ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {unavailable
                          ? 'Out of stock'
                          : `${product.available_stock} available`}
                      </span>
                    </div>

                    {invalidPrice && (
                      <p className="mt-2 text-xs text-red-600">
                        Invalid selling price
                      </p>
                    )}

                    <button
                      onClick={() => addToCart(product)}
                      disabled={unavailable || invalidPrice || limitReached}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
                    >
                      <Plus size={16} />
                      {unavailable
                        ? 'Unavailable'
                        : limitReached
                          ? 'Maximum quantity reached'
                          : 'Add to Cart'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* CART */}

        <section className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <ShoppingCart size={21} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                Current Order
              </h2>

              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {totalItems}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-medium text-red-600"
              >
                Clear Cart
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart
                size={35}
                className="mx-auto text-slate-300"
              />
              <p className="mt-3 font-medium text-slate-700">
                Your cart is empty
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Select products to begin an order.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cart.map(item => (
                <div key={item.id} className="p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatUSD(item.selling_price)} each
                      </p>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="h-fit text-slate-400 hover:text-red-600"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => changeQuantity(item.id, -1)}
                        className="rounded-lg border p-1.5 hover:bg-slate-50"
                      >
                        <Minus size={15} />
                      </button>

                      <span className="min-w-5 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => changeQuantity(item.id, 1)}
                        disabled={item.quantity >= item.available_stock}
                        className="rounded-lg border p-1.5 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    <span className="font-semibold text-slate-900">
                      {formatUSD(
                        (toCents(item.selling_price) * item.quantity) / 100
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4 border-t border-slate-200 bg-slate-50 p-5">
            {cartErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {cartErrors.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            )}

            <div className="flex justify-between text-sm text-slate-600">
              <span>Total Items</span>
              <span>{totalItems}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                Order Total
              </span>

              <span className="text-xl font-bold text-slate-900">
                {formatUSD(cartTotal / 100)}
              </span>
            </div>

            <button
              onClick={proceedToPayment}
              disabled={cart.length === 0 || cartErrors.length > 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Proceed to Cash Payment
            </button>

            <p className="text-center text-xs text-slate-500">
              Cash payment is currently the only supported method.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
