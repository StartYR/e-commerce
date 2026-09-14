<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const route = useRoute()
const router = useRouter()
const { login } = useAuth()
const form = reactive({ login: '', password: '' })
const errorMessage = ref('')
const submitting = ref(false)

async function submit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await login(form)
    const redirect = typeof route.query.redirect === 'string'
      && route.query.redirect.startsWith('/')
      && !route.query.redirect.startsWith('//')
      ? route.query.redirect
      : '/'
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main id="main-content" class="auth-main container" tabindex="-1">
    <section class="auth-card" aria-labelledby="login-title">
      <p class="eyebrow">WELCOME BACK</p>
      <h1 id="login-title">登录拾页</h1>
      <p class="auth-intro">继续查看购物车、订单与属于你的日常好物。</p>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          <span>用户名或邮箱</span>
          <input v-model.trim="form.login" name="login" autocomplete="username" required maxlength="254" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128" />
        </label>
        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
        <button class="primary-button auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? '正在登录…' : '登录' }}
        </button>
      </form>

      <p class="auth-alternate">还没有账号？<RouterLink to="/register">创建账号</RouterLink></p>
    </section>
  </main>
</template>
