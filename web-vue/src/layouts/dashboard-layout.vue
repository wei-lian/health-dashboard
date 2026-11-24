<script setup>
import { navigation } from '../router/index.js'
import { feedback, initializePersonalData, startPersonalSync, sync } from '../stores/local-store.js'
import { hasLiveContent, loadContent } from '../stores/content-store.js'
import { playback, stopAudio } from '../stores/audio-store.js'
import { getSession, signOut } from '../utils/auth-session.js'
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
let stopSync, sessionTimer
// 会话在页面停留期间到期或窗口重新聚焦时也会返回登录页。
function checkSession() {
  if (!getSession()) void router.replace({ name: 'login', query: { redirect: route.fullPath } })
}
// 退出后卸载业务布局、停止同步与音频，保留用户记录。
function handleLogout() {
  if (sync.saving) return
  signOut()
  void router.replace({ name: 'login' })
}
onMounted(() => {
  void loadContent()
  void initializePersonalData()
  stopSync = startPersonalSync()
  sessionTimer = setInterval(checkSession, 30000)
  window.addEventListener('focus', checkSession)
})
onUnmounted(() => {
  stopSync?.()
  stopAudio()
  clearInterval(sessionTimer)
  window.removeEventListener('focus', checkSession)
})
const page = computed(() => navigation.find((item) => item.path === route.path) || navigation[0])
const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(
  new Date(),
)
watch(
  () => route.path,
  () => {
    menuOpen.value = false
    document.title = `${page.value.label} · 每日一屏`
  },
  { immediate: true },
)
</script>

<template>
  <div class="app-shell" :class="{ 'has-player': playback.key }">
    <button v-if="menuOpen" class="nav-scrim" aria-label="关闭导航" @click="menuOpen = false"></button>
    <aside class="sidebar" :class="{ open: menuOpen }">
      <RouterLink to="/" class="brand"
        ><span class="brand-symbol">D<span></span></span
        ><span>每日一屏<small>DAILY DASH</small></span></RouterLink
      >
      <div class="nav-caption">我的日常 <span>MY EVERYDAY</span></div>
      <nav aria-label="主导航">
        <RouterLink
          v-for="item in navigation.filter((item) => item.path !== '/settings')"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: route.path === item.path }"
          ><AppIcon :name="item.icon" :size="19" /><span>{{ item.label }}</span
          ><span v-if="item.path === '/daily'" class="nav-dot"></span
        ></RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="little-note">
          <AppIcon name="leaf" :size="23" />
          <p>好好生活，<br />每天进步一点点。</p>
          <span>ONE DAY AT A TIME</span>
        </div>
        <RouterLink to="/settings" class="nav-link" :class="{ active: route.path === '/settings' }"
          ><AppIcon name="settings" :size="19" />设置与备份</RouterLink
        >
        <div class="local-label"><AppIcon name="shield" :size="14" /> 个人空间 · 数据本地保存</div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="icon-button mobile-menu"
            aria-label="打开导航"
            :aria-expanded="menuOpen"
            @click="menuOpen = true"
          >
            <AppIcon name="menu" /></button
          ><span>我的生活空间</span><AppIcon name="next" :size="13" /><strong>{{ page.label }}</strong>
        </div>
        <div class="topbar-right">
          <span class="demo-badge">{{
            hasLiveContent ? '个人仪表盘 · 本地数据' : '等待采集 · 示例内容'
          }}</span><span class="avatar" aria-label="当前账号 admin">A</span>
          <button class="logout-button" aria-label="退出登录" :disabled="sync.saving" @click="handleLogout">
            <AppIcon name="logout" :size="17" /><span>退出登录</span>
          </button>
        </div>
      </header>
      <main id="main-content">
        <div class="page-heading">
          <div>
            <div class="eyebrow">{{ page.eyebrow }}</div>
            <h1>{{ page.title }}</h1>
            <p>{{ page.description }}</p>
          </div>
          <div class="date-chip">
            <AppIcon name="sun" :size="20" /><span>{{ dateLabel }}<small>今天，也要过得有声有色</small></span>
          </div>
        </div>
        <DataOverview />
        <SaveStatus />
        <RouterView />
        <footer class="page-footer">
          <span>DAILY DASH <i>·</i> 日常的小事，生活的大事。</span
          ><span><span class="status-dot"></span> 本地优先，安心记录</span>
        </footer>
      </main>
    </div>
    <MediaPlayer />
    <Transition name="toast"
      ><div v-if="feedback.text" class="toast" :class="feedback.type" role="status">
        <AppIcon :name="feedback.type === 'error' ? 'help' : 'success'" :size="19" />{{ feedback.text }}
      </div></Transition
    >
  </div>
</template>

<style scoped>
.logout-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  color: #65765e;
  font-size: 0.8125rem;
  white-space: nowrap;
}
.logout-button:hover {
  color: var(--green);
}
@media (max-width: 600px) {
  .logout-button span {
    display: none;
  }
}
</style>
