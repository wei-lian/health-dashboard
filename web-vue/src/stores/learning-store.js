import { state, persist, notify } from './local-store.js'
import { dailyStudy, scheduleWord, wordQueue, recordWordPractice } from '../../../shared/learning.js'
import { localDate } from '../utils/health.js'
import { publicAssetUrl } from '../utils/deployment.js'

export const library = reactive({ words: [], loading: false, error: '', source: '' })
export const learningToday = ref(localDate())
let pending

// 页面重新聚焦与跨午夜时重新计算当天目标。
export function refreshLearningDate() {
  learningToday.value = localDate()
}
export const todayStudy = computed(() => dailyStudy(state.studyHistory, learningToday.value))
export const listeningMinutes = computed(() =>
  state.listeningLogs.filter((i) => i.date === learningToday.value).reduce((sum, i) => sum + i.minutes, 0),
)
export const newQueue = computed(() =>
  wordQueue(library.words, state.wordProgress, state.studyHistory, state.learningPlan, learningToday.value),
)
export const reviewQueue = computed(() =>
  wordQueue(
    library.words,
    state.wordProgress,
    state.studyHistory,
    state.learningPlan,
    learningToday.value,
    'review',
  ),
)

// 词库按需加载；只读取仓库内文件，失败时可重试，不把演示词当完整词库。
export async function loadVocabulary() {
  if (library.words.length) return true
  if (pending) return pending
  pending = (async () => {
    library.loading = true
    library.error = ''
    try {
      const response = await fetch(publicAssetUrl('/library/vocabulary.json'), {
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) throw new Error('词库文件读取失败')
      const data = await response.json()
      if (
        !Array.isArray(data.words) ||
        data.words.length < 5000 ||
        data.words.some((w) => !w.w || !w.cn || !w.eg || !w.egCn)
      )
        throw new Error('词库不完整，请重新运行单词导入脚本')
      library.words = data.words
      library.source = data.source
      return true
    } catch (error) {
      library.error = error.message
      return false
    } finally {
      library.loading = false
      pending = null
    }
  })()
  return pending
}

// 一次保存同时更新复习安排和当天计数，磁盘确认前不前进到下一个词。
export async function rateWord(word, rating, sentence) {
  const date = learningToday.value
  const previous = state.wordProgress.find((i) => i.word === word)
  const progress = scheduleWord(previous, word, rating, date, sentence)
  const day = recordWordPractice(state.studyHistory, previous, word, rating, date)
  const mastered = state.mastered.filter((i) => i !== word)
  if (progress.level >= 3) mastered.push(word)
  return persist({
    wordProgress: [...state.wordProgress.filter((i) => i.word !== word), progress],
    studyHistory: [...state.studyHistory.filter((i) => i.id !== date), day],
    mastered,
  })
}

// 诗词阅读打卡与收藏分开计数，重复点击同一首不增加进度。
export async function completePoem(id) {
  const day = { ...todayStudy.value, poems: [...new Set([...todayStudy.value.poems, id])] }
  if (await persist({ studyHistory: [...state.studyHistory.filter((i) => i.id !== day.id), day] }))
    notify('已记录今日诗词学习')
}
