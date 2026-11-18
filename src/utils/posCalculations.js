
export function calculateLineTotal(price, quantity) {
  const unitPrice = Number(price)
  const qty = Number(quantity)

  if (!Number.isFinite(unitPrice) || !Number.isInteger(qty)) {
    return 0
  }

  return Math.round((unitPrice * qty + Number.EPSILON) * 100) / 100
}

export function calculateOrderTotal(cart) {
  return Math.round(
    cart.reduce(
      (total, item) =>
        total + calculateLineTotal(
          item.selling_price,
          item.quantity
        ),
      0
    ) * 100
  ) / 100
}

export function validateCart(cart) {
  const errors = []

  if (!cart.length) {
    errors.push('Your cart is empty.')
    return errors
  }

  cart.forEach(item => {
    const price = Number(item.selling_price)
    const quantity = Number(item.quantity)
    const stock = Number(item.available_stock)

    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`${item.name}: Invalid selling price.`)
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push(`${item.name}: Quantity must be a positive whole number.`)
    }

    if (!Number.isFinite(stock) || quantity > stock) {
      errors.push(`${item.name}: Requested quantity exceeds available stock.`)
    }
  })

  return errors
}

export function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(amount) || 0)
}
