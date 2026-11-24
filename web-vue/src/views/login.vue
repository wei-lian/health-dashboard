<script setup>
import { signIn, loginDestination } from '../utils/auth-session.js'

const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const error = ref('')

onMounted(() => {
  document.title = '登录 · 每日一屏'
})

// 回车与点击共用单飞锁，失败保留账号并允许重新提交。
async function handleLogin() {
  if (submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await signIn(username.value, password.value)
    password.value = ''
    await router.replace(loginDestination(route.query.redirect))
  } catch (cause) {
    error.value = cause.message || '登录失败，请稍后重试。'
  } finally {
    await new Promise((done) => setTimeout(done, 400))
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-story" aria-label="每日一屏介绍">
      <div class="brand">
        <span class="brand-symbol">D<span></span></span>
        <span>每日一屏<small>DAILY DASH</small></span>
      </div>
      <div class="login-story-body">
        <p class="login-kicker">A LITTLE BETTER, EVERY DAY</p>
        <h1>好好生活，<br />从今天这一屏开始。</h1>
        <p>记录身体的节奏，也收藏日常的灵感。<br />让每一个平凡的日子，都有一点新收获。</p>
        <BotanicalArt />
        <div class="login-features">
          <span><AppIcon name="activity" :size="17" />记录运动与睡眠</span>
          <span><AppIcon name="leaf" :size="17" />发现每日小美好</span>
        </div>
      </div>
      <p class="login-story-footer">ONE DAY AT A TIME · 每天进步一点点</p>
    </section>
    <section class="login-panel" aria-labelledby="login-title">
      <form class="login-form" :aria-busy="submitting" @submit.prevent="handleLogin">
        <div class="login-welcome-icon"><AppIcon name="sun" :size="26" /></div>
        <p class="login-kicker">WELCOME BACK</p>
        <h2 id="login-title">欢迎回到你的生活空间</h2>
        <p class="login-description">登录后，开启今天的日常记录与发现。</p>
        <label class="login-field" for="username">
          <span>账号</span>
          <span class="login-input-wrap">
            <AppIcon name="user" :size="19" />
            <input
              id="username"
              v-model="username"
              name="username"
              autocomplete="username"
              placeholder="请输入账号"
              :disabled="submitting"
              :aria-invalid="Boolean(error)"
              aria-describedby="login-error"
              autofocus
              required
              maxlength="64"
            />
          </span>
        </label>
        <label class="login-field" for="password">
          <span>密码</span>
          <span class="login-input-wrap">
            <AppIcon name="lock" :size="19" />
            <input
              id="password"
              v-model="password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="请输入密码"
              :disabled="submitting"
              :aria-invalid="Boolean(error)"
              aria-describedby="login-error"
              required
              maxlength="128"
            />
            <button
              type="button"
              class="login-password-toggle"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="19" />
            </button>
          </span>
        </label>
        <p id="login-error" class="login-error" role="alert">{{ error }}</p>
        <button
          class="button primary login-submit"
          type="submit"
          :disabled="submitting"
          :aria-busy="submitting"
        >
          <AppIcon v-if="submitting" name="refresh" class="spinning" :size="18" />
          {{ submitting ? '正在登录…' : '登录，开启今天' }}
          <AppIcon v-if="!submitting" name="right" :size="18" />
        </button>
        <p class="login-hint"><AppIcon name="shield" :size="15" />登录状态仅保留在当前浏览器会话中</p>
      </form>
      <p class="login-panel-footer">日常的小事，生活的大事。</p>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  max-width: none;
  margin: 0;
  padding: 0;
  min-height: 100svh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--paper);
}
.login-story {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px clamp(32px, 5vw, 80px) 30px;
  background: #edf2e6;
}
.login-story .brand {
  padding: 0;
}
.login-story-body {
  padding: 65px 0 30px;
}
.login-kicker {
  color: #6f876d;
  font-size: 0.75rem;
  letter-spacing: 2.5px;
  font-weight: 600;
}
.login-story h1 {
  margin: 20px 0;
  font-size: clamp(2rem, 3.1vw, 3rem);
  line-height: 1.5;
  letter-spacing: 1px;
  color: #254b37;
}
.login-story-body > p:not(.login-kicker) {
  color: #71816a;
  line-height: 2;
  font-size: 0.9375rem;
}
.login-story-body :deep(.botanical-art) {
  display: block;
  position: static;
  width: min(100%, 380px);
  height: auto;
  margin: 15px auto;
}
.login-features {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 26px;
  color: #5f7759;
  font-size: 0.8125rem;
}
.login-features span,
.login-hint {
  display: flex;
  align-items: center;
  gap: 8px;
}
.login-story-footer,
.login-panel-footer {
  color: #88947e;
  font-size: 0.75rem;
  letter-spacing: 1px;
}
.login-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 70px 40px 32px;
}
.login-form {
  width: min(100%, 380px);
  margin: auto 0;
}
.login-welcome-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1px solid #dfe9d7;
  border-radius: 17px;
  background: #f3f6ed;
  color: #668357;
  margin-bottom: 28px;
}
.login-form h2 {
  font-size: clamp(1.25rem, 2vw, 1.65rem);
  font-weight: 600;
  letter-spacing: 0.5px;
  margin: 10px 0;
}
.login-description {
  color: #879180;
  font-size: 0.875rem;
  margin-bottom: 38px;
}
.login-field {
  display: grid;
  gap: 9px;
  margin-top: 21px;
  font-size: 0.875rem;
  font-weight: 500;
}
.login-input-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #dee4d9;
  border-radius: 9px;
  background: #fff;
  padding: 0 15px;
  color: #8a9784;
}
.login-input-wrap:focus-within {
  border-color: #72976f;
  outline: 3px solid #e9f0e3;
}
.login-input-wrap input {
  width: 100%;
  min-width: 0;
  height: 50px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 0.9375rem;
}
.login-input-wrap input::placeholder {
  color: #a4ad9f;
}
.login-password-toggle {
  padding: 10px 0 10px 5px;
  display: flex;
}
.login-error {
  min-height: 40px;
  padding-top: 9px;
  color: #a04437;
  font-size: 0.8125rem;
}
.login-submit {
  width: 100%;
  justify-content: center;
  min-height: 50px;
  border-radius: 9px;
}
.login-hint {
  justify-content: center;
  margin-top: 22px;
  color: #8a9483;
  font-size: 0.75rem;
}
.login-panel-footer {
  margin-top: 48px;
}
@media (min-width: 1500px) {
  .login-story-body {
    max-width: 560px;
    align-self: center;
    width: 100%;
  }
}
@media (max-width: 760px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .login-story {
    padding: 26px 25px;
  }
  .login-story .brand {
    font-size: 1.25rem;
  }
  .login-story .brand small {
    font-size: 0.625rem;
  }
  .login-story-body {
    padding: 28px 0 0;
  }
  .login-story h1 {
    font-size: 1.75rem;
    margin: 12px 0;
  }
  .login-story-body > p:not(.login-kicker),
  .login-story-body :deep(.botanical-art),
  .login-features,
  .login-story-footer {
    display: none;
  }
  .login-panel {
    padding: 32px 25px 24px;
  }
  .login-welcome-icon {
    display: none;
  }
  .login-description {
    margin-bottom: 25px;
  }
  .login-panel-footer {
    margin-top: 36px;
  }
}
</style>
