import { createApp, nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import ShopView from './views/ShopView.vue'
import CartView from './views/CartView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import OrdersView from './views/OrdersView.vue'
import OrderView from './views/OrderView.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: ShopView, meta: { title: '拾页 · 文具小店' } },
    { path: '/cart', component: CartView, meta: { title: '我的购物车 · 拾页' } },
    { path: '/login', component: LoginView, meta: { title: '登录 · 拾页' } },
    { path: '/register', component: RegisterView, meta: { title: '创建账号 · 拾页' } },
    { path: '/orders', component: OrdersView, meta: { title: '我的订单 · 拾页' } },
    { path: '/orders/:id', component: OrderView, meta: { title: '订单详情 · 拾页' } },
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
