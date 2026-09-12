<script setup>
import AppIcon from '../components/AppIcon.vue'
import ProductArt from '../components/ProductArt.vue'
import { useCart } from '../composables/useCart.js'
import { formatMoney } from '../data/products.js'
import { MAX_QUANTITY, normalizeQuantity } from '../lib/cart.js'

const { lines, count, total, setQuantity, remove } = useCart()
function updateQuantity(productId, event) {
  const quantity = normalizeQuantity(event.target.value)
  setQuantity(productId, quantity)
  event.target.value = quantity
}
</script>

<template>
  <main id="main-content" class="cart-main container" tabindex="-1">
    <RouterLink to="/" class="back-link"><AppIcon name="back" />继续逛逛</RouterLink>
    <div class="cart-heading"><div><p class="eyebrow section-eyebrow">YOUR LITTLE FINDS</p><h1>我的购物车<span>把喜欢的，先放在这里。</span></h1></div><span v-if="count" class="cart-heading-count">{{ count }} 件小欢喜</span></div>
    <div v-if="lines.length" class="cart-layout">
      <section class="cart-items" aria-label="购物车商品">
        <div class="cart-table-header"><span>商品</span><span>数量</span><span>小计</span><span></span></div>
        <article v-for="line in lines" :key="line.productId" class="cart-row" :data-product-id="line.productId">
          <div class="cart-product"><div class="cart-product-image" :style="{ backgroundColor: line.product.background }"><ProductArt :kind="line.product.art" :color="line.product.color" /></div><div class="cart-product-copy"><h2>{{ line.product.name }}</h2><p>{{ line.product.description }}</p><span>¥ {{ formatMoney(line.product.price) }}</span></div></div>
          <div class="quantity-control"><button :disabled="line.quantity <= 1" :aria-label="`减少${line.product.name}数量`" @click="setQuantity(line.productId, line.quantity - 1)"><AppIcon name="minus" /></button><input type="number" inputmode="numeric" min="1" :max="MAX_QUANTITY" :value="line.quantity" :aria-label="`${line.product.name}数量`" @change="updateQuantity(line.productId, $event)" /><button :disabled="line.quantity >= MAX_QUANTITY" :aria-label="`增加${line.product.name}数量`" @click="setQuantity(line.productId, line.quantity + 1)"><AppIcon name="plus" /></button></div>
          <span class="line-total">¥ {{ formatMoney(line.product.price * line.quantity) }}</span>
          <button class="remove-button" :aria-label="`移除${line.product.name}`" @click="remove(line.productId)"><AppIcon name="trash" /></button>
        </article>
        <p class="cart-hint"><AppIcon name="leaf" />慢慢挑，留给真正喜欢的东西。</p>
      </section>
      <aside class="cart-summary" aria-labelledby="summary-title">
        <p class="eyebrow">A LITTLE COLLECTION</p><h2 id="summary-title">你的好物清单</h2>
        <div class="summary-line"><span>已选商品</span><span>{{ lines.length }} 款 / {{ count }} 件</span></div>
        <div class="summary-total"><span>商品合计</span><strong data-testid="cart-total"><span>¥</span>{{ formatMoney(total) }}</strong></div>
        <RouterLink to="/" class="primary-button">再逛一会儿<AppIcon name="arrow" /></RouterLink>
        <p class="summary-note">小店目前开放浏览与选购，<br />暂未开放下单和支付。</p>
      </aside>
    </div>
    <div v-else class="empty-state cart-empty"><span class="empty-icon"><AppIcon name="bag" /></span><p class="eyebrow">ROOM FOR SOMETHING LOVELY</p><h2>购物车还空着呢</h2><p>一本新笔记，一支顺手的笔，<br />去发现让你心动的第一件好物吧。</p><RouterLink to="/" class="primary-button">去逛逛小店<AppIcon name="arrow" /></RouterLink></div>
  </main>
</template>
