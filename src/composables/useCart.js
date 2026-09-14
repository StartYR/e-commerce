import { computed, ref, watch } from 'vue'
import { CART_KEY, MAX_QUANTITY, getCartLines, getCartTotal, normalizeQuantity, readCart } from '../lib/cart.js'
import { products } from '../data/products.js'
import { useAuth } from './useAuth.js'

const guestItems = ref([])
const remoteLines = ref([])
const guestStorageWarning = ref('')
const loading = ref(false)
const updating = ref(false)
const error = ref('')
const { user } = useAuth()
let remoteQueue = Promise.resolve()
let remoteGeneration = 0
let remoteLoaded = false

try {
  guestItems.value = readCart(window.localStorage)
} catch {
  guestStorageWarning.value = '浏览器暂时无法保存购物车，关闭页面后本次选择可能丢失。'
}

function persistGuestCart() {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify({ version: 1, items: guestItems.value }))
    guestStorageWarning.value = ''
  } catch {
    guestStorageWarning.value = '浏览器暂时无法保存购物车，关闭页面后本次选择可能丢失。'
  }
}

function normalizeRemoteCart(cart) {
  if (!Array.isArray(cart?.items)) return []
  return cart.items.flatMap((item) => {
    const presentation = products.find((product) => product.id === item?.productId)
    if (!presentation || !Number.isInteger(item.quantity) || item.quantity < 1) return []
    return [{
      productId: item.productId,
      quantity: Math.min(MAX_QUANTITY, item.quantity),
      product: {
        ...presentation,
        name: item.name,
        description: item.description,
        price: Number(item.priceCents),
        category: item.categoryId,
        stock: Number(item.stock),
        isActive: Boolean(item.isActive),
      },
    }]
  })
}

async function cartRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const requestError = new Error(
      body?.error?.code === 'PRODUCT_NOT_FOUND'
        ? '商品已下架或不存在。'
        : '购物车更新失败，请稍后再试。',
    )
    requestError.status = response.status
    requestError.code = body?.error?.code
    throw requestError
  }
  return body?.cart
}

async function loadRemoteCart(expectedUserId, generation) {
  loading.value = true
  error.value = ''
  try {
    const cart = await cartRequest('/api/cart')
    if (user.value?.id === expectedUserId && generation === remoteGeneration) {
      remoteLines.value = normalizeRemoteCart(cart)
      remoteLoaded = true
    }
  } catch (loadError) {
    if (user.value?.id === expectedUserId && generation === remoteGeneration) {
      error.value = loadError.message
    }
    throw loadError
  } finally {
    if (user.value?.id === expectedUserId && generation === remoteGeneration) {
      loading.value = false
    }
  }
}

watch(user, (currentUser) => {
  remoteGeneration += 1
  const generation = remoteGeneration
  error.value = ''
  updating.value = false
  remoteLoaded = false
  if (!currentUser) {
    remoteLines.value = []
    loading.value = false
    remoteQueue = Promise.resolve()
    return
  }

  remoteLines.value = []
  remoteQueue = loadRemoteCart(currentUser.id, generation).catch(() => {})
})

const lines = computed(() => user.value ? remoteLines.value : getCartLines(guestItems.value))
const count = computed(() => lines.value.reduce((sum, item) => sum + item.quantity, 0))
const total = computed(() => user.value
  ? lines.value.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  : getCartTotal(guestItems.value))
const storageWarning = computed(() => user.value ? '' : guestStorageWarning.value)

function queueRemoteMutation(operation) {
  const expectedUserId = user.value?.id
  const generation = remoteGeneration
  const task = remoteQueue.then(async () => {
    updating.value = true
    error.value = ''
    try {
      if (user.value?.id !== expectedUserId || generation !== remoteGeneration) return null
      if (!remoteLoaded) await loadRemoteCart(expectedUserId, generation)
      if (user.value?.id !== expectedUserId || generation !== remoteGeneration) return null
      const cart = await operation()
      if (cart && user.value?.id === expectedUserId && generation === remoteGeneration) {
        remoteLines.value = normalizeRemoteCart(cart)
      }
      return cart
    } catch (mutationError) {
      if (user.value?.id === expectedUserId && generation === remoteGeneration) {
        error.value = mutationError.message
      }
      throw mutationError
    } finally {
      if (user.value?.id === expectedUserId && generation === remoteGeneration) {
        updating.value = false
      }
    }
  })
  remoteQueue = task.catch(() => {})
  return task
}

export function useCart() {
  async function add(productId) {
    if (!products.some((product) => product.id === productId)) return false
    if (user.value) {
      const cart = await queueRemoteMutation(async () => {
        const item = remoteLines.value.find((line) => line.productId === productId)
        if (item?.quantity >= MAX_QUANTITY) return null
        return cartRequest(`/api/cart/items/${encodeURIComponent(productId)}`, {
          method: 'PUT',
          body: JSON.stringify({ quantity: (item?.quantity ?? 0) + 1 }),
        })
      })
      return cart !== null
    }

    const item = guestItems.value.find((line) => line.productId === productId)
    if (item?.quantity >= MAX_QUANTITY) return false
    if (item) item.quantity += 1
    else guestItems.value.push({ productId, quantity: 1 })
    persistGuestCart()
    return true
  }

  async function setQuantity(productId, value) {
    const quantity = normalizeQuantity(value)
    if (user.value) {
      await queueRemoteMutation(() => cartRequest(`/api/cart/items/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
      }))
      return
    }

    const item = guestItems.value.find((line) => line.productId === productId)
    if (!item) return
    item.quantity = quantity
    persistGuestCart()
  }

  async function remove(productId) {
    if (user.value) {
      await queueRemoteMutation(() => cartRequest(`/api/cart/items/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      }))
      return
    }

    guestItems.value = guestItems.value.filter((line) => line.productId !== productId)
    persistGuestCart()
  }

  return { lines, count, total, storageWarning, loading, updating, error, add, setQuantity, remove }
}
