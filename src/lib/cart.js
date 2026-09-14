export const CART_KEY = 'shiye-cart-v1'
export const MAX_QUANTITY = 99

export function normalizeQuantity(value) {
  const quantity = Number(value)
  return Number.isFinite(quantity) ? Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity))) : 1
}

export function sanitizeCart(value) {
  if (!Array.isArray(value)) return []
  const quantities = new Map()
  for (const item of value) {
    if (!item || typeof item.productId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(item.productId)) continue
    if (!Number.isInteger(item.quantity) || item.quantity < 1) continue
    quantities.set(item.productId, Math.min(MAX_QUANTITY, (quantities.get(item.productId) ?? 0) + item.quantity))
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
}

export function readCart(storage) {
  const raw = storage.getItem(CART_KEY)
  if (!raw) return []
  try {
    const saved = JSON.parse(raw)
    return saved?.version === 1 ? sanitizeCart(saved.items) : []
  } catch {
    return []
  }
}

export function getCartLines(items, products) {
  return sanitizeCart(items).flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)
    return product ? [{ ...item, product }] : []
  })
}

export function getCartTotal(items, products) {
  return getCartLines(items, products).reduce((total, { product, quantity }) => total + product.price * quantity, 0)
}
