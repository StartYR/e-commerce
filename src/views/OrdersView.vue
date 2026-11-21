<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { useOrders } from '../composables/useOrders.js'
import { formatMoney } from '../data/products.js'

const { user, ready } = useAuth()
const { list } = useOrders()
const orders = ref([])
const nextCursor = ref(null)
const loading = ref(false)
const error = ref('')
let requestSignal

async function loadPage(cursor = null) {
  const signal = requestSignal
  if (!signal || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const page = await list(cursor, signal)
    if (signal.aborted) return
    orders.value = cursor ? [...orders.value, ...page.orders] : page.orders
    nextCursor.value = page.nextCursor
  } catch (loadError) {
    if (!signal.aborted) error.value = loadError.message
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

watch([ready, user], ([isReady, currentUser], _previous, onCleanup) => {
  orders.value = []
  nextCursor.value = null
  loading.value = false
  error.value = ''
  requestSignal = undefined
  if (!isReady || !currentUser) return

  const controller = new AbortController()
  requestSignal = controller.signal
  onCleanup(() => controller.abort())
  loadPage()
}, { immediate: true })

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <main id="main-content" class="orders-main container" tabindex="-1">
    <RouterLink to="/" class="back-link">继续逛逛</RouterLink>
    <div class="cart-heading">
      <div><p class="eyebrow section-eyebrow">ORDER HISTORY</p><h1>我的订单<span>每一笔选择，都从数据库如实读回。</span></h1></div>
    </div>
    <p v-if="error" class="cart-operation-error" role="alert">{{ error }}</p>
    <div v-if="!ready || (loading && !orders.length)" class="empty-state cart-empty" aria-live="polite"><p>正在读取订单…</p></div>
    <div v-else-if="!user" class="empty-state cart-empty"><h2>登录后查看订单</h2><p>订单只对创建它的账户可见。</p><RouterLink to="/login" class="primary-button">前往登录</RouterLink></div>
    <div v-else-if="orders.length" class="order-list">
      <RouterLink v-for="order in orders" :key="order.id" :to="`/orders/${order.id}`" class="order-card" :data-order-id="order.id">
        <div><span>订单 #{{ order.id }}</span><time :datetime="order.createdAt">{{ formatDate(order.createdAt) }}</time></div>
        <div><span>{{ order.items.reduce((sum, item) => sum + item.quantity, 0) }} 件商品</span><strong>¥{{ formatMoney(order.totalAmountCents) }}</strong><em>{{ order.status }}</em></div>
      </RouterLink>
      <button v-if="nextCursor" type="button" class="secondary-button order-load-more" :disabled="loading" @click="loadPage(nextCursor)">
        {{ loading ? '正在读取订单…' : '加载更多订单' }}
      </button>
    </div>
    <div v-else-if="error" class="empty-state cart-empty"><button type="button" class="secondary-button" @click="loadPage()">重新加载订单</button></div>
    <div v-else class="empty-state cart-empty"><h2>还没有订单</h2><p>从购物车确认下单后，订单会出现在这里。</p><RouterLink to="/" class="primary-button">去挑选商品</RouterLink></div>
  </main>
</template>
