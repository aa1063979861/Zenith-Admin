<template>
  <div class="login-shell">
    <main class="login-stage">
      <section class="login-brief" aria-labelledby="login-brand-title">
        <div class="brand-hero">
          <div class="brand-mark">
            <img :src="companyLogo" alt="众恒科技">
          </div>
          <div class="brand-copy">
            <h1 id="login-brand-title">
              众恒科技
            </h1>
            <p>管理系统</p>
          </div>
        </div>

        <p class="brief-note">
          客户、订单、合同、票款统一入口。
        </p>
      </section>

      <section class="login-panel" aria-labelledby="login-title">
        <div class="panel-heading">
          <h2 id="login-title">
            欢迎登录
          </h2>
        </div>

        <n-form class="login-form" label-placement="top">
          <n-form-item label="账号">
            <n-input
              v-model:value="loginInfo.username"
              autofocus
              placeholder="请输入账号"
              :maxlength="32"
            >
              <template #prefix>
                <i class="field-icon i-fe:user" aria-hidden="true" />
              </template>
            </n-input>
          </n-form-item>

          <n-form-item label="密码">
            <n-input
              v-model:value="loginInfo.password"
              type="password"
              show-password-on="mousedown"
              placeholder="请输入密码"
              :maxlength="32"
              @keydown.enter="handleLogin()"
            >
              <template #prefix>
                <i class="field-icon i-fe:lock" aria-hidden="true" />
              </template>
            </n-input>
          </n-form-item>
        </n-form>

        <div class="login-options">
          <n-checkbox
            :checked="isRemember"
            label="记住账号"
            :on-update:checked="(val) => (isRemember = val)"
          />
        </div>

        <div class="login-actions">
          <n-button type="primary" :loading="loading" @click="handleLogin()">
            登录
          </n-button>
        </div>
      </section>
    </main>

    <TheFooter class="login-footer" />
  </div>
</template>

<script setup>
import { useStorage } from '@vueuse/core'
import companyLogo from '@/assets/images/company-logo.png'
import { useAuthStore } from '@/store'
import { lStorage } from '@/utils'
import api from './api'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const loginInfo = ref({
  username: '',
  password: '',
})

const localLoginInfo = lStorage.get('loginInfo')
if (localLoginInfo && typeof localLoginInfo.username === 'string') {
  loginInfo.value.username = localLoginInfo.username
  lStorage.set('loginInfo', { username: loginInfo.value.username })
}

const isRemember = useStorage('isRemember', true)
const loading = ref(false)

async function handleLogin(isQuick) {
  const { username, password, captcha } = loginInfo.value
  if (!username || !password)
    return $message.warning('请输入账号和密码')

  try {
    loading.value = true
    $message.loading('正在验证，请稍后...', { key: 'login' })

    const { data } = await api.login({ username, password: password.toString(), captcha, isQuick })
    persistLoginInfo(username)
    onLoginSuccess(data)
  }
  catch (error) {
    $message.destroy('login')
    console.error(error)
  }
  finally {
    loading.value = false
  }
}

function persistLoginInfo(username) {
  if (isRemember.value)
    lStorage.set('loginInfo', { username })
  else
    lStorage.remove('loginInfo')
}

async function onLoginSuccess(data = {}) {
  await authStore.replaceLoginSession(data)
  $message.loading('登录中...', { key: 'login' })
  try {
    $message.success('登录成功', { key: 'login' })
    if (route.query.redirect) {
      const path = route.query.redirect
      delete route.query.redirect
      router.push({ path, query: route.query })
    }
    else {
      router.push('/')
    }
  }
  catch (error) {
    console.error(error)
    $message.destroy('login')
  }
}
</script>

<style scoped>
.login-shell {
  position: relative;
  min-height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  color: #0f172a;
  letter-spacing: 0;
  background:
    linear-gradient(
      120deg,
      rgba(var(--primary-color), 0.1) 0%,
      rgba(var(--primary-color), 0.03) 36%,
      rgba(255, 255, 255, 0) 62%
    ),
    linear-gradient(150deg, #eef5f6 0%, #f8fafc 48%, #ffffff 100%);
}

.login-shell::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background:
    linear-gradient(104deg, rgba(255, 255, 255, 0.48) 0 30%, rgba(255, 255, 255, 0.12) 30% 48%, transparent 48%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.64), rgba(255, 255, 255, 0));
  opacity: 0.82;
}

.brand-hero,
.login-options,
.login-actions,
.login-actions {
  display: flex;
  align-items: center;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  background: linear-gradient(135deg, rgba(var(--primary-color), 0.1), rgba(var(--primary-color), 0.02)), #fff;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.08),
    inset 0 0 0 1px rgba(var(--primary-color), 0.16);
}

.brand-mark {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  padding: 10px;
  box-shadow:
    0 24px 54px rgba(15, 23, 42, 0.12),
    0 6px 18px rgba(var(--primary-color), 0.1),
    inset 0 0 0 1px rgba(var(--primary-color), 0.16);
}

.brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.login-brief::before,
.login-brief::after {
  position: absolute;
  pointer-events: none;
  content: '';
}

.login-brief::before {
  inset: 0;
  background:
    linear-gradient(
      126deg,
      rgba(255, 255, 255, 0.14) 0 18%,
      transparent 18% 46%,
      rgba(255, 255, 255, 0.08) 46% 56%,
      transparent 56%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0));
}

.login-brief::after {
  right: -74px;
  bottom: -70px;
  width: 260px;
  height: 260px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  transform: rotate(18deg);
}

.brand-hero {
  position: relative;
  z-index: 1;
  gap: 22px;
}

.brand-copy {
  display: grid;
  gap: 8px;
}

.brand-copy h1 {
  margin: 0;
  font-size: 48px;
  font-weight: 780;
  line-height: 58px;
  color: #fff;
}

.brand-copy p {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  line-height: 28px;
  color: rgba(255, 255, 255, 0.84);
}

.login-stage {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 410px;
  align-items: stretch;
  gap: 0;
  flex: 0 1 auto;
  width: min(980px, calc(100vw - 64px));
  height: min(620px, calc(100vh - 108px));
  min-height: 540px;
  margin: auto;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.68);
  box-shadow:
    0 38px 110px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(28px);
}

.login-brief {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 64px 58px;
  overflow: hidden;
  background: linear-gradient(138deg, rgba(var(--primary-color), 0.98) 0%, #285a68 54%, #173a49 100%);
}

.brief-note {
  position: relative;
  z-index: 1;
  max-width: 390px;
  margin: 34px 0 0 110px;
  font-size: 16px;
  line-height: 26px;
  color: rgba(255, 255, 255, 0.78);
}

.login-panel {
  width: 100%;
  padding: 58px 48px;
  border-left: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.92);
}

.panel-heading h2 {
  margin: 0;
  font-size: 30px;
  font-weight: 760;
  line-height: 38px;
  color: #0f172a;
}

.login-form {
  margin-top: 34px;
}

.login-form :deep(.n-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.n-form-item-label) {
  min-height: 24px;
  padding-bottom: 7px;
  color: #334155;
  font-size: 13px;
  font-weight: 650;
}

.login-form :deep(.n-input) {
  --n-height: 48px;
  --n-border-radius: 8px;
  font-size: 14px;
}

.field-icon {
  margin-right: 8px;
  color: #94a3b8;
  font-size: 16px;
}

.login-options {
  justify-content: flex-start;
  gap: 12px;
  margin-top: 2px;
}

.login-actions {
  gap: 12px;
  margin-top: 28px;
}

.login-actions :deep(.n-button) {
  flex: 1;
  height: 46px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 650;
}

.login-footer {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 12px 0 20px;
}

.dark .login-shell {
  color: #e5e7eb;
  background:
    linear-gradient(
      118deg,
      rgba(var(--primary-color), 0.2) 0%,
      rgba(var(--primary-color), 0.08) 34%,
      rgba(15, 23, 42, 0) 58%
    ),
    linear-gradient(150deg, #111827 0%, #0f172a 52%, #020617 100%);
}

.dark .login-shell::before {
  background:
    linear-gradient(104deg, rgba(255, 255, 255, 0.08) 0 34%, rgba(255, 255, 255, 0.03) 34% 53%, transparent 53%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
}

.dark .login-shell::after {
  display: none;
}

.dark .panel-heading h2 {
  color: #f8fafc;
}

.dark .brief-note {
  color: #94a3b8;
}

.dark .login-panel {
  border-left-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.72);
}

.dark .login-stage {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.68);
  box-shadow:
    0 38px 110px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.dark .login-form :deep(.n-form-item-label) {
  color: #cbd5e1;
}

@media (max-width: 1100px) {
  .login-stage {
    width: min(560px, calc(100vw - 40px));
  }

  .login-stage {
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    height: auto;
    min-height: auto;
  }

  .brand-hero {
    justify-content: center;
  }

  .login-brief {
    text-align: center;
    width: 100%;
    padding: 36px 28px;
  }

  .brand-copy h1 {
    font-size: 38px;
    line-height: 46px;
  }

  .brief-note {
    margin: 20px auto 0;
  }
}

@media (max-width: 640px) {
  .login-stage {
    width: calc(100vw - 28px);
  }

  .brand-hero {
    gap: 14px;
  }

  .brand-mark {
    width: 64px;
    height: 64px;
    padding: 8px;
  }

  .brand-copy h1 {
    font-size: 30px;
    line-height: 38px;
  }

  .brand-copy p {
    font-size: 16px;
    line-height: 22px;
  }

  .brief-note {
    font-size: 14px;
    line-height: 22px;
  }

  .login-panel {
    width: 100%;
    padding: 24px;
    border-left: 0;
  }

  .panel-heading h2 {
    font-size: 22px;
    line-height: 30px;
  }

  .login-actions {
    flex-direction: column;
  }

  .login-actions :deep(.n-button) {
    flex: none;
    width: 100%;
    min-height: 44px;
  }

  .login-footer {
    padding-bottom: 14px;
  }
}
</style>
