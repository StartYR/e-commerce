<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useOrders } from '../composables/useOrders.js'
import { formatMoney } from '../data/products.js'

const route = useRoute()
const { user, ready } = useAuth()
const { loading, error, get } = useOrders()
const order = ref(null)

watch([ready, user, () => route.params.id], ([isReady, currentUser, orderId]) => {
  order.value = null
  if (isReady && currentUser) {
    get(orderId).then((result) => { order.value = result }).catch(() => {})
  }
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
    <RouterLink to="/orders" class="back-link">返回订单记录</RouterLink>
    <p v-if="error" class="cart-operation-error order-detail-error" role="alert">{{ error }}</p>
    <div v-if="!ready || loading" class="empty-state cart-empty" aria-live="polite"><p>正在读取订单…</p></div>
    <div v-else-if="!user" class="empty-state cart-empty"><h2>登录后查看订单</h2><p>订单只对创建它的账户可见。</p><RouterLink to="/login" class="primary-button">前往登录</RouterLink></div>
    <article v-else-if="order" class="order-detail" :data-order-id="order.id">
      <header><p class="eyebrow">ORDER PLACED</p><h1>订单 #{{ order.id }}</h1><p><time :datetime="order.createdAt">{{ formatDate(order.createdAt) }}</time><span>{{ order.status }}</span></p></header>
      <section aria-label="订单商品">
        <div v-for="item in order.items" :key="item.productId" class="order-item">
          <div><h2>{{ item.name }}</h2><p>{{ item.description }}</p></div>
          <span>{{ item.quantity }} × ¥{{ formatMoney(item.unitPriceCents) }}</span>
          <strong>¥{{ formatMoney(item.quantity * item.unitPriceCents) }}</strong>
        </div>
      </section>
      <footer><span>订单合计</span><strong data-testid="order-total">¥{{ formatMoney(order.totalAmountCents) }}</strong></footer>
      <p class="summary-note">当前订单状态为 placed；本项目暂未接入真实支付。</p>
    </article>
  </main>
</template>
