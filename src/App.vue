<script setup>
import { onMounted, ref } from 'vue'
import AppIcon from './components/AppIcon.vue'
import { useAuth } from './composables/useAuth.js'
import { useCart } from './composables/useCart.js'
const { count, storageWarning } = useCart()
const { user, ready, refresh, logout } = useAuth()
const accountError = ref('')

onMounted(() => {
  refresh().catch(() => {
    accountError.value = '暂时无法确认登录状态。'
  })
})

async function signOut() {
  accountError.value = ''
  try {
    await logout()
  } catch {
    accountError.value = '退出失败，请稍后再试。'
  }
}

function focusMain() {
  const main = document.getElementById('main-content')
  main?.focus({ preventScroll: true })
  main?.scrollIntoView()
}
</script>

<template>
  <a class="skip-link" href="#main-content" @click.prevent="focusMain">跳到主要内容</a>
  <div class="announcement"><AppIcon name="sun" /><span>新学期，从一件喜欢的文具开始。</span><span class="announcement-dot">·</span><span class="announcement-end">给日常一点小欢喜</span></div>
  <header class="site-header">
    <div class="header-inner container">
      <RouterLink to="/" class="brand" aria-label="拾页文具小店首页">
        <span class="brand-mark"><AppIcon name="book" /><i></i></span>
        <span class="brand-name">拾页<span>SHIYE STATIONERY</span></span>
      </RouterLink>
      <nav class="main-nav" aria-label="主导航">
        <RouterLink to="/" class="nav-link" exact-active-class="current">逛逛小店</RouterLink>
        <RouterLink to="/cart" class="nav-link" exact-active-class="current">我的购物车</RouterLink>
      </nav>
      <div class="header-actions">
        <span v-if="!ready" class="account-state" aria-label="正在确认登录状态">账户…</span>
        <template v-else-if="user">
          <span class="account-name">{{ user.username }}</span>
          <button class="account-action" type="button" @click="signOut">退出</button>
        </template>
        <RouterLink v-else to="/login" class="account-action">登录</RouterLink>
        <RouterLink to="/cart" class="header-cart" :aria-label="`购物车，${count} 件商品`"><AppIcon name="bag" /><span class="cart-label">购物车</span><span class="cart-count">{{ count }}</span></RouterLink>
      </div>
    </div>
  </header>
  <div v-if="accountError" class="storage-warning container" role="alert">{{ accountError }}</div>
  <div v-if="storageWarning" class="storage-warning container" role="alert">{{ storageWarning }}</div>
  <RouterView />
  <footer class="site-footer">
    <div class="footer-inner container">
      <div class="footer-brand"><AppIcon name="book" /><strong>拾页</strong><span>认真挑选，慢慢喜欢。</span></div>
      <p>一间关于纸、笔与日常的小店。<span>© {{ new Date().getFullYear() }} SHIYE</span></p>
    </div>
  </footer>
</template>
