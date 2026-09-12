<script setup>
import { computed, onUnmounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import ProductArt from '../components/ProductArt.vue'
import ProductCard from '../components/ProductCard.vue'
import { categories, products } from '../data/products.js'
import { useCart } from '../composables/useCart.js'

const category = ref('all')
const query = ref('')
const sort = ref('featured')
const notice = ref('')
const { add } = useCart()
let noticeTimer
const filteredProducts = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  const result = products.filter((product) =>
    (category.value === 'all' || product.category === category.value)
    && `${product.name} ${product.description}`.toLocaleLowerCase().includes(search),
  )
  if (sort.value === 'price-asc') result.sort((a, b) => a.price - b.price)
  if (sort.value === 'price-desc') result.sort((a, b) => b.price - a.price)
  return result
})

function addProduct(product) {
  notice.value = add(product.id) ? `已将「${product.name}」加入购物车` : '这件商品已经选了 99 件，先看看其他好物吧。'
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 3000)
}

function resetFilters() {
  query.value = ''
  category.value = 'all'
  sort.value = 'featured'
}

function browse() {
  const collection = document.getElementById('collection')
  collection.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  document.getElementById('collection-title').focus({ preventScroll: true })
}
onUnmounted(() => clearTimeout(noticeTimer))
</script>

<template>
  <main id="main-content" class="shop-main container" tabindex="-1">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow"><span></span> A LITTLE JOY, EVERY DAY</p>
        <h1 id="hero-title">把日常，<br />写成喜欢的样子<span>。</span></h1>
        <p class="hero-description">一本新笔记，一支顺手的笔。<br />从桌面上的小小喜欢，开始新的一页。</p>
        <button class="primary-button" @click="browse">挑选好物<AppIcon name="arrow" /></button>
        <div class="hero-footnote"><span class="tiny-leaf"><AppIcon name="leaf" /></span>简单、实用，也有一点心动。</div>
      </div>
      <div class="hero-scene" aria-hidden="true">
        <div class="scene-orbit"></div>
        <span class="scene-word">a fresh page,<br /><i>a fresh start.</i></span>
        <ProductArt class="scene-spiral" kind="spiral" color="#c1a782" />
        <ProductArt class="scene-notebook" kind="notebook" color="#778a71" />
        <ProductArt class="scene-pens" kind="pens" color="#788873" />
        <ProductArt class="scene-tape" kind="tape" />
        <div class="scene-label"><span>拾页 · 开学好物</span><span>GOOD THINGS FOR SLOW DAYS</span></div>
        <svg class="scene-spark" viewBox="0 0 60 60"><path d="M30 3v18m0 18v18M3 30h18m18 0h18M11 11l10 10m18 18 10 10M11 49l10-10m18-18L49 11" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
      </div>
    </section>

    <section id="collection" class="collection" aria-labelledby="collection-title">
      <div class="collection-heading">
        <div><p class="eyebrow section-eyebrow">THE EVERYDAY COLLECTION</p><h2 id="collection-title" tabindex="-1">桌面上的小确幸<span>为你的每一天，挑点喜欢的。</span></h2></div>
        <span class="collection-note"><AppIcon name="leaf" /> 好用的，才是想留下的</span>
      </div>
      <div class="shop-toolbar">
        <div class="category-list" role="group" aria-label="商品分类">
          <button v-for="item in categories" :key="item.id" class="category-button" :class="{ selected: category === item.id }" :aria-pressed="category === item.id" @click="category = item.id"><AppIcon :name="item.icon" />{{ item.name }}</button>
        </div>
        <div class="search-field"><AppIcon name="search" /><input v-model="query" type="search" aria-label="搜索商品" placeholder="找找你喜欢的好物" /><button v-if="query" aria-label="清除搜索" @click="query = ''"><AppIcon name="close" /></button></div>
      </div>
      <div class="results-toolbar">
        <p aria-live="polite">共 <strong>{{ filteredProducts.length }}</strong> 件好物<span v-if="query.trim()"> · 搜索“{{ query.trim() }}”</span></p>
        <label class="sort-field"><span class="sr-only">商品排序</span><select v-model="sort" aria-label="商品排序"><option value="featured">小店推荐</option><option value="price-asc">价格从低到高</option><option value="price-desc">价格从高到低</option></select><AppIcon name="chevron" /></label>
      </div>
      <div v-if="filteredProducts.length" class="product-grid">
        <ProductCard v-for="product in filteredProducts" :key="product.id" :product="product" @add="addProduct" />
      </div>
      <div v-else class="empty-state search-empty"><span class="empty-icon"><AppIcon name="search" /></span><h3>还没找到这件好物</h3><p>换个关键词，或看看其他分类吧。</p><button class="secondary-button" @click="resetFilters">查看全部好物<AppIcon name="arrow" /></button></div>
      <div class="collection-ending"><span></span><AppIcon name="sun" /><p>好物不必很多，喜欢就刚刚好。</p><span></span></div>
    </section>
    <div class="toast-region" role="status" aria-live="polite" aria-atomic="true"><Transition name="toast"><div v-if="notice" class="toast"><AppIcon name="check" /><span>{{ notice }}</span><RouterLink to="/cart">查看购物车<AppIcon name="arrow" /></RouterLink></div></Transition></div>
  </main>
</template>
