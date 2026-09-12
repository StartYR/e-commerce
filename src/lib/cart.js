import { products } from '../data/products.js'

export const CART_KEY = 'shiye-cart-v1'
export const MAX_QUANTITY = 99
const productIds = new Set(products.map((product) => product.id))

export function normalizeQuantity(value) {
  const quantity = Number(value)
  return Number.isFinite(quantity) ? Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity))) : 1
}

export function sanitizeCart(value) {
  if (!Array.isArray(value)) return []
  const quantities = new Map()
  for (const item of value) {
    if (!item || !productIds.has(item.productId)) continue
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

export function getCartLines(items) {
  return sanitizeCart(items).map((item) => ({
    ...item,
    product: products.find((product) => product.id === item.productId),
  }))
}

export function getCartTotal(items) {
  return getCartLines(items).reduce((total, { product, quantity }) => total + product.price * quantity, 0)
}
