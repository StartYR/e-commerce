<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const router = useRouter()
const { register } = useAuth()
const form = reactive({ username: '', email: '', password: '' })
const errorMessage = ref('')
const submitting = ref(false)

async function submit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await register(form)
    await router.replace('/')
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main id="main-content" class="auth-main container" tabindex="-1">
    <section class="auth-card" aria-labelledby="register-title">
      <p class="eyebrow">START A NEW PAGE</p>
      <h1 id="register-title">创建账号</h1>
      <p class="auth-intro">注册后即可在不同访问中保存登录状态。</p>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          <span>用户名</span>
          <input v-model.trim="form.username" name="username" autocomplete="username" required minlength="3" maxlength="50" pattern="[\p{L}\p{N}_-]{3,50}" />
          <small>3–50 个字母、数字、下划线或连字符</small>
        </label>
        <label>
          <span>邮箱</span>
          <input v-model.trim="form.email" name="email" type="email" autocomplete="email" required maxlength="254" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" />
          <small>至少 8 个字符</small>
        </label>
        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
        <button class="primary-button auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? '正在创建…' : '创建账号' }}
        </button>
      </form>

      <p class="auth-alternate">已经有账号？<RouterLink to="/login">返回登录</RouterLink></p>
    </section>
  </main>
</template>
