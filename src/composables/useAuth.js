import { ref } from 'vue'

const user = ref(null)
const ready = ref(false)
const ERROR_MESSAGES = {
  ACCOUNT_EXISTS: '用户名或邮箱已经注册。',
  INVALID_CREDENTIALS: '用户名、邮箱或密码不正确。',
  INVALID_EMAIL: '请输入有效的邮箱地址。',
  INVALID_LOGIN: '请输入用户名或邮箱。',
  INVALID_PASSWORD: '密码需要包含 8–128 个字符。',
  INVALID_USERNAME: '用户名需要包含 3–50 个字母、数字、下划线或连字符。',
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const body = response.status === 204
    ? null
    : await response.json().catch(() => null)
  if (!response.ok) {
    const code = body?.error?.code
    const error = new Error(ERROR_MESSAGES[code] || '请求失败，请稍后再试。')
    error.code = code
    error.status = response.status
    throw error
  }
  return body
}

export function useAuth() {
  async function refresh() {
    try {
      user.value = (await apiRequest('/api/auth/me')).user
    } catch (error) {
      user.value = null
      if (error.status && error.status !== 401) throw error
    } finally {
      ready.value = true
    }
    return user.value
  }

  async function login(credentials) {
    user.value = (await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })).user
    ready.value = true
    return user.value
  }

  async function register(account) {
    user.value = (await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(account),
    })).user
    ready.value = true
    return user.value
  }

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    user.value = null
    ready.value = true
  }

  return { user, ready, refresh, login, register, logout }
}
