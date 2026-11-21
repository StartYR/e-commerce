<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth.js'

const { user, ready } = useAuth()
const from = ref('')
const to = ref('')
const report = ref(null)
const loading = ref(false)
const error = ref('')
const numberFormat = new Intl.NumberFormat('zh-CN')
let requestSignal

const ERROR_MESSAGES = {
  AUTH_REQUIRED: '请重新登录后查看经营统计。',
  ADMIN_REQUIRED: '只有管理员可以查看经营统计。',
  INVALID_STATS_RANGE: '请选择有效的日期范围，最多 31 天。',
}

function formatAmount(value) {
  const cents = BigInt(value)
  return `¥${numberFormat.format(cents / 100n)}.${String(cents % 100n).padStart(2, '0')}`
}

async function loadStats(query = '') {
  const signal = requestSignal
  if (!signal || loading.value) return
  report.value = null
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`/api/admin/stats${query}`, { credentials: 'same-origin', signal })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body) {
      throw new Error(ERROR_MESSAGES[body?.error?.code] || '无法读取经营统计，请稍后重试。')
    }
    if (signal.aborted) return
    report.value = body
    from.value = body.from
    to.value = body.to
  } catch (loadError) {
    if (!signal.aborted) error.value = loadError.message
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

function applyFilters() {
  const query = new URLSearchParams({ from: from.value, to: to.value })
  loadStats(`?${query}`)
}

watch([ready, user], ([isReady, currentUser], _previous, onCleanup) => {
  from.value = ''
  to.value = ''
  report.value = null
  error.value = ''
  loading.value = false
  requestSignal = undefined
  if (!isReady || !currentUser?.isAdmin) return

  const controller = new AbortController()
  requestSignal = controller.signal
  onCleanup(() => controller.abort())
  loadStats()
}, { immediate: true })
</script>

<template>
  <main id="main-content" class="orders-main container" tabindex="-1">
    <RouterLink to="/" class="back-link">返回小店</RouterLink>
    <div class="cart-heading"><h1>经营统计</h1></div>

    <p v-if="!ready" class="empty-state cart-empty" role="status">正在确认登录状态…</p>
    <div v-else-if="!user" class="empty-state cart-empty">
      <h2>请先登录</h2>
      <RouterLink :to="{ path: '/login', query: { redirect: '/admin/stats' } }" class="primary-button">前往登录</RouterLink>
    </div>
    <div v-else-if="!user.isAdmin" class="empty-state cart-empty">
      <h2>只有管理员可以查看经营统计</h2>
    </div>
    <template v-else>
      <form class="stats-filter" @submit.prevent="applyFilters">
        <label>开始日期<input v-model="from" type="date" :max="to || undefined" :disabled="loading" required /></label>
        <label>结束日期<input v-model="to" type="date" :min="from || undefined" :disabled="loading" required /></label>
        <button type="submit" class="secondary-button" :disabled="loading">查询</button>
      </form>
      <p class="stats-note">按 UTC+8 日期统计已下单订单，范围最多 31 天。下单金额按成交价统计。</p>

      <p v-if="loading" class="stats-status" role="status">正在读取统计…</p>
      <div v-else-if="error" class="stats-status">
        <p class="cart-operation-error" role="alert">{{ error }}</p>
        <button v-if="!from && !to" type="button" class="secondary-button" @click="loadStats()">重试</button>
      </div>
      <p v-else-if="report && !report.daily.length" class="stats-status" role="status">这个日期范围内没有已下单订单。</p>
      <div v-else-if="report" class="stats-grid">
        <section class="stats-panel" aria-labelledby="daily-stats-title">
          <h2 id="daily-stats-title">每日订单</h2>
          <div class="stats-table-wrap">
            <table class="stats-table" aria-labelledby="daily-stats-title">
              <thead><tr><th scope="col">日期</th><th scope="col">订单数</th><th scope="col">下单金额</th></tr></thead>
              <tbody>
                <tr v-for="day in report.daily" :key="day.date">
                  <th scope="row"><time :datetime="day.date">{{ day.date }}</time></th>
                  <td>{{ numberFormat.format(BigInt(day.orderCount)) }}</td>
                  <td>{{ formatAmount(day.amountCents) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="stats-panel" aria-labelledby="product-stats-title">
          <h2 id="product-stats-title">商品销量</h2>
          <div class="stats-table-wrap">
            <table class="stats-table" aria-labelledby="product-stats-title">
              <thead><tr><th scope="col">商品</th><th scope="col">销量</th><th scope="col">下单金额</th></tr></thead>
              <tbody>
                <tr v-for="product in report.products" :key="product.productId">
                  <th scope="row">{{ product.name }}</th>
                  <td>{{ numberFormat.format(BigInt(product.unitsSold)) }}</td>
                  <td>{{ formatAmount(product.amountCents) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </main>
</template>
