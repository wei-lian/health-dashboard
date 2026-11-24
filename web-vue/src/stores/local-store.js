import { reactive, computed } from 'vue'
import { localDate, streakDays } from '../utils/health.js'
import { isBrowserStorage } from '../utils/deployment.js'
import { requestBrowserPersonalData } from '../utils/browser-personal-data.js'
import {
  emptyPersonalData,
  validatePersonalData,
  hasPersonalContent,
} from '../../../shared/personal-schema.js'

const cacheKey = 'dailydash.cache.v2'
const legacyKey = 'dailydash.local.v1'
const migratedKey = 'dailydash.migrated.v1'
let cached = emptyPersonalData(),
  legacy = null,
  migrated = false
try {
  const old = localStorage.getItem(legacyKey)
  if (old) legacy = validatePersonalData(JSON.parse(old))
  const cache = localStorage.getItem(cacheKey)
  cached = cache ? validatePersonalData(JSON.parse(cache)) : legacy || cached
  migrated = Boolean(localStorage.getItem(migratedKey))
} catch {
  /* 损坏缓存不覆盖磁盘数据，也不删除原始浏览器记录。 */
}
export const state = reactive(cached)
export const sync = reactive({
  mode: isBrowserStorage ? 'browser' : 'file',
  ready: false,
  online: false,
  saving: false,
  checking: false,
  revision: 0,
  storeId: '',
  file: '',
  updatedAt: '',
  error: '',
  message: '',
})
export const feedback = reactive({ text: '', type: 'success' })
let noticeTimer, initializing, refreshing, stopWatching

// 操作反馈与磁盘写入状态分别维护。
export function notify(text, type = 'success') {
  clearTimeout(noticeTimer)
  Object.assign(feedback, { text, type })
  noticeTimer = setTimeout(() => {
    feedback.text = ''
  }, 3500)
}

// API 仅访问当前本机服务，失败不假装已保存。
async function requestPersonal(path = '', options = {}) {
  if (isBrowserStorage) return requestBrowserPersonalData(path, options)
  const response = await fetch('/api/personal-data' + path, {
    ...options,
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!(response.headers.get('content-type') || '').includes('application/json'))
    throw new Error('本机保存服务未启动，请用 npm run dev 或 npm start 打开页面')
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.error || '本机保存失败')
    error.current = result.current
    throw error
  }
  return result
}

// 只有磁盘确认写入后才更新界面；浏览器缓存仅用于服务断开时查看。
function adopt(value) {
  const data = validatePersonalData(value.data)
  Object.assign(state, data)
  Object.assign(sync, {
    online: true,
    ready: true,
    revision: value.revision,
    storeId: value.storeId,
    file: value.file || sync.file,
    updatedAt: value.updatedAt || '',
    error: '',
  })
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data))
  } catch {
    /* 磁盘已保存，浏览器缓存失败不影响记录。 */
  }
}

// 第一次连接自动迁移旧浏览器记录；服务端同时保留一份迁移原件。
export async function initializePersonalData() {
  if (initializing) return initializing
  initializing = (async () => {
    sync.checking = true
    try {
      let current = await requestPersonal()
      const recover =
        !migrated && legacy && hasPersonalContent(legacy)
          ? legacy
          : !current.exists && hasPersonalContent(cached)
            ? cached
            : null
      if (recover) {
        current = await requestPersonal('/migrate', {
          method: 'POST',
          body: JSON.stringify({ data: recover }),
        })
        sync.message = isBrowserStorage
          ? '已恢复此浏览器原有记录，请定期下载 JSON 备份。'
          : '原浏览器记录已迁移到电脑文件，迁移原件另存于 recoveries 文件夹。'
      }
      adopt(current)
      if (legacy && !migrated) {
        try {
          localStorage.setItem(migratedKey, new Date().toISOString())
          migrated = true
        } catch {
          /* 下次迁移仍按 ID 合并，原件不会丢失。 */
        }
      }
      return true
    } catch (error) {
      sync.error = error.message
      sync.ready = true
      sync.online = false
      return false
    } finally {
      sync.checking = false
      initializing = null
    }
  })()
  return initializing
}

// 轮询和重新聚焦只读取新版本，保存过程中不覆盖正在提交的状态。
export async function refreshPersonalData() {
  if (refreshing) return refreshing
  if (initializing) return initializing
  if (sync.saving) return false
  if (!sync.ready || (!sync.online && !sync.storeId)) return initializePersonalData()
  refreshing = (async () => {
    try {
      const value = await requestPersonal()
      if (sync.storeId && (!value.exists || value.storeId !== sync.storeId))
        throw new Error('保存的记录被移除或替换，请重新连接并核对备份')
      if (!sync.saving && value.revision > sync.revision) adopt(value)
      else if (!sync.saving) {
        sync.online = true
        sync.error = ''
      }
      return true
    } catch (error) {
      sync.online = false
      sync.error = error.message
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

// 文件版本冲突时读取最新状态，保留表单供用户重试，绝不静默覆盖其他窗口。
export async function persist(changes) {
  if (sync.saving) return false
  if (!sync.ready || !sync.online) {
    notify('保存服务未就绪，请点击顶部重新连接；本次修改尚未保存。', 'error')
    return false
  }
  sync.saving = true
  try {
    const data = validatePersonalData({ ...state, ...changes })
    const value = await requestPersonal('', {
      method: 'PUT',
      body: JSON.stringify({ revision: sync.revision, data }),
    })
    adopt(value)
    return true
  } catch (error) {
    if (error.current) {
      adopt(error.current)
      notify('其他窗口已更新，已读取最新数据，请重新保存本次修改。', 'error')
    } else {
      sync.error = error.message
      notify('保存失败，本次修改尚未保存：' + error.message, 'error')
    }
    return false
  } finally {
    await new Promise((done) => setTimeout(done, 400))
    sync.saving = false
  }
}

// 收藏、已读、掌握也写入同一份电脑文件，随备份一起迁移。
export async function toggleItem(field, id) {
  if (!['favorites', 'mastered', 'readNews'].includes(field)) return false
  const items = state[field]
  return persist({ [field]: items.includes(id) ? items.filter((item) => item !== id) : [...items, id] })
}

// 跨浏览器每五秒同步，回到窗口时立即检查；关闭页面会清理监听。
export function startPersonalSync() {
  if (stopWatching) return stopWatching
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void refreshPersonalData()
  }, 5000)
  const focus = () => void refreshPersonalData()
  window.addEventListener('focus', focus)
  stopWatching = () => {
    clearInterval(timer)
    window.removeEventListener('focus', focus)
    stopWatching = null
  }
  return stopWatching
}

export const todaySports = computed(() => state.sports.filter((item) => item.date === localDate()))
export const sportTotal = computed(() => todaySports.value.reduce((total, item) => total + item.duration, 0))
export const latestSleep = computed(() => [...state.sleeps].sort((a, b) => b.date.localeCompare(a.date))[0])
export const streak = computed(() => streakDays(state.sports))
