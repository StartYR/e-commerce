<script setup>
import { onUnmounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import ProductArt from './ProductArt.vue'
import { formatMoney } from '../data/products.js'

defineProps({ product: { type: Object, required: true } })
const emit = defineEmits(['add'])
const recentlyAdded = ref(false)
let timer
function add(product) {
  emit('add', product)
  recentlyAdded.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { recentlyAdded.value = false }, 1100)
}
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <article class="product-card" :data-product-id="product.id">
    <div class="product-image" :style="{ backgroundColor: product.background }">
      <span v-if="product.badge" class="product-badge">{{ product.badge }}</span>
      <ProductArt :kind="product.art" :color="product.color" />
      <span class="image-caption">SHIYE SELECTED</span>
    </div>
    <div class="product-info">
      <h3>{{ product.name }}</h3>
      <p>{{ product.description }}</p>
      <div class="product-bottom">
        <span class="price"><span class="currency">¥</span>{{ formatMoney(product.price) }}</span>
        <button class="add-button" :class="{ added: recentlyAdded }" :aria-label="`将${product.name}加入购物车`" @click="add(product)">
          <AppIcon :name="recentlyAdded ? 'check' : 'plus'" /><span>{{ recentlyAdded ? '已选择' : '加入购物车' }}</span>
        </button>
      </div>
    </div>
  </article>
</template>
