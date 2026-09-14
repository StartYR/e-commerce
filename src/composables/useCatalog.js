import { ref } from 'vue'
import { categoryPresentation, presentCategory, presentProduct } from '../data/products.js'

const products = ref([])
const categories = ref([{ id: 'all', ...categoryPresentation.all }])
const loading = ref(false)
const ready = ref(false)
const error = ref('')
let pendingRequest

function validateProduct(product) {
  return product
    && typeof product.id === 'string'
    && typeof product.name === 'string'
    && typeof product.description === 'string'
    && Number.isInteger(product.priceCents)
    && product.priceCents >= 0
    && Number.isInteger(product.stock)
    && product.stock >= 0
    && typeof product.isActive === 'boolean'
    && typeof product.categoryId === 'string'
}

function validateCategory(category) {
  return category && typeof category.id === 'string' && typeof category.name === 'string'
}

async function requestJson(path) {
  const response = await fetch(path, { credentials: 'same-origin' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`)
  return body
}

async function fetchCatalog() {
  loading.value = true
  error.value = ''
  try {
    const [productBody, categoryBody] = await Promise.all([
      requestJson('/api/products'),
      requestJson('/api/categories'),
    ])
    if (!Array.isArray(productBody?.products) || !productBody.products.every(validateProduct)) {
      throw new Error('Product response is invalid')
    }
    if (!Array.isArray(categoryBody?.categories) || !categoryBody.categories.every(validateCategory)) {
      throw new Error('Category response is invalid')
    }

    products.value = productBody.products
      .map(presentProduct)
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    categories.value = [
      { id: 'all', ...categoryPresentation.all },
      ...categoryBody.categories
        .map(presentCategory)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
    ]
    ready.value = true
  } catch {
    products.value = []
    categories.value = [{ id: 'all', ...categoryPresentation.all }]
    ready.value = false
    error.value = '商品暂时无法加载，请稍后再试。'
    throw new Error(error.value)
  } finally {
    loading.value = false
    pendingRequest = null
  }
}

export function useCatalog() {
  function load({ force = false } = {}) {
    if (ready.value && !force) return Promise.resolve(products.value)
    if (pendingRequest && !force) return pendingRequest
    pendingRequest = fetchCatalog()
    return pendingRequest
  }

  return { products, categories, loading, ready, error, load }
}
