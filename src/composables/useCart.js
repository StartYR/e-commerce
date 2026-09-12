import { computed, ref } from 'vue'
import { CART_KEY, MAX_QUANTITY, getCartLines, getCartTotal, normalizeQuantity, readCart } from '../lib/cart.js'
import { products } from '../data/products.js'

const items = ref([])
const storageWarning = ref('')
try {
  items.value = readCart(window.localStorage)
} catch {
  storageWarning.value = '浏览器暂时无法保存购物车，关闭页面后本次选择可能丢失。'
}

function persist() {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify({ version: 1, items: items.value }))
    storageWarning.value = ''
  } catch {
    storageWarning.value = '浏览器暂时无法保存购物车，关闭页面后本次选择可能丢失。'
  }
}

const lines = computed(() => getCartLines(items.value))
const count = computed(() => lines.value.reduce((sum, item) => sum + item.quantity, 0))
const total = computed(() => getCartTotal(items.value))

export function useCart() {
  function add(productId) {
    if (!products.some((product) => product.id === productId)) return false
    const item = items.value.find((line) => line.productId === productId)
    if (item?.quantity >= MAX_QUANTITY) return false
    if (item) item.quantity += 1
    else items.value.push({ productId, quantity: 1 })
    persist()
    return true
  }

  function setQuantity(productId, value) {
    const item = items.value.find((line) => line.productId === productId)
    if (!item) return
    item.quantity = normalizeQuantity(value)
    persist()
  }

  function remove(productId) {
    items.value = items.value.filter((line) => line.productId !== productId)
    persist()
  }

  return { lines, count, total, storageWarning, add, setQuantity, remove }
}
