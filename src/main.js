import { createApp, nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import ShopView from './views/ShopView.vue'
import CartView from './views/CartView.vue'
import './style.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ShopView, meta: { title: '拾页 · 文具小店' } },
    { path: '/cart', component: CartView, meta: { title: '我的购物车 · 拾页' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach(async (to, from) => {
  document.title = to.meta.title
  if (from.matched.length) {
    await nextTick()
    document.querySelector('main')?.focus({ preventScroll: true })
  }
})

createApp(App).use(router).mount('#app')
