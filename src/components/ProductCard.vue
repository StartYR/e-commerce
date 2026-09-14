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
  if (!product.isActive || product.stock <= 0) return
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
        <button class="add-button" :class="{ added: recentlyAdded }" :disabled="!product.isActive || product.stock <= 0" :aria-label="product.stock > 0 ? `将${product.name}加入购物车` : `${product.name}暂时售罄`" @click="add(product)">
          <AppIcon :name="recentlyAdded ? 'check' : 'plus'" /><span>{{ product.stock <= 0 ? '暂时售罄' : recentlyAdded ? '已选择' : '加入购物车' }}</span>
        </button>
      </div>
    </div>
  </article>
</template>
