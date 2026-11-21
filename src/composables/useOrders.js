import { ref, watch } from 'vue'
import { useAuth } from './useAuth.js'

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
  INVALID_ORDER_CURSOR: '无法继续读取订单，请刷新页面后重试。',
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
  loading.value = false
  placing.value = false
  error.value = ''
})

export function useOrders() {
  function list(cursor, signal) {
    const path = cursor ? `/api/orders?${new URLSearchParams({ cursor })}` : '/api/orders'
    return orderRequest(path, { signal })
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
      return (await orderRequest('/api/orders', { method: 'POST' })).order
    } catch (placeError) {
      error.value = placeError.message
      throw placeError
    } finally {
      placing.value = false
    }
  }

  return { loading, placing, error, list, get, place }
}
