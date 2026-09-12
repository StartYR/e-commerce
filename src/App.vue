<script setup>
import AppIcon from './components/AppIcon.vue'
import { useCart } from './composables/useCart.js'
const { count, storageWarning } = useCart()

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
      <RouterLink to="/cart" class="header-cart" :aria-label="`购物车，${count} 件商品`"><AppIcon name="bag" /><span class="cart-label">购物车</span><span class="cart-count">{{ count }}</span></RouterLink>
    </div>
  </header>
  <div v-if="storageWarning" class="storage-warning container" role="alert">{{ storageWarning }}</div>
  <RouterView />
  <footer class="site-footer">
    <div class="footer-inner container">
      <div class="footer-brand"><AppIcon name="book" /><strong>拾页</strong><span>认真挑选，慢慢喜欢。</span></div>
      <p>一间关于纸、笔与日常的小店。<span>© {{ new Date().getFullYear() }} SHIYE</span></p>
    </div>
  </footer>
</template>
