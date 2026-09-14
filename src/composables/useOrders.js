import { ref, watch } from 'vue'
import { useAuth } from './useAuth.js'

const orders = ref([])
const loading = ref(false)
const placing = ref(false)
const error = ref('')
const { user } = useAuth()

const ERROR_MESSAGES = {
  AUTH_REQUIRED: '请先登录后再查看或创建订单。',
  CART_EMPTY: '购物车为空，暂时无法下单。',
  INSUFFICIENT_STOCK: '部分商品库存不足，请调整购物车后重试。',
  PRODUCT_UNAVAILABLE: '部分商品已下架，请调整购物车后重试。',
  ORDER_NOT_FOUND: '没有找到这笔订单。',
}

async function orderRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const code = body?.error?.code
    const requestError = new Error(ERROR_MESSAGES[code] || '订单请求失败，请稍后再试。')
    requestError.code = code
    requestError.status = response.status
    throw requestError
  }
  return body
}

watch(user, () => {
  orders.value = []
  loading.value = false
  placing.value = false
  error.value = ''
})

export function useOrders() {
  async function load() {
    loading.value = true
    error.value = ''
    try {
      orders.value = (await orderRequest('/api/orders')).orders
      return orders.value
    } catch (loadError) {
      error.value = loadError.message
      throw loadError
    } finally {
      loading.value = false
    }
  }

  async function get(orderId) {
    loading.value = true
    error.value = ''
    try {
      return (await orderRequest(`/api/orders/${encodeURIComponent(orderId)}`)).order
    } catch (loadError) {
      error.value = loadError.message
      throw loadError
    } finally {
      loading.value = false
    }
  }

  async function place() {
    placing.value = true
    error.value = ''
    try {
      const order = (await orderRequest('/api/orders', { method: 'POST' })).order
      orders.value = [order, ...orders.value.filter((candidate) => candidate.id !== order.id)]
      return order
    } catch (placeError) {
      error.value = placeError.message
      throw placeError
    } finally {
      placing.value = false
    }
  }

  return { orders, loading, placing, error, load, get, place }
}
