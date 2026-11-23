import { reactive, computed } from 'vue'
import * as demo from '../data/demo.js'
import { validateData } from '../../../shared/content-schema.js'
import { simplifyPoem } from '../../../shared/poetry.js'
import { readJson } from '../utils/read-json.js'

export const news = reactive([...demo.news])
export const songs = reactive([...demo.songs])
export const words = reactive([...demo.words])
export const poems = reactive(demo.poems.map(simplifyPoem))
export const quizzes = reactive([...demo.quizzes])
export const knowledge = reactive([...demo.knowledge])
export const food = reactive({ ...demo.food })
export const devices = reactive([...demo.devices])
export const content = reactive({ files: {}, meta: null, loading: false, loaded: false, error: '' })
export const hasLiveContent = computed(() => Object.keys(content.files).length > 0)
const modules = ['hotNews', 'songRank', 'englishWord', 'poetry', 'quiz', 'knowledge', 'food', 'digital']

// 保留响应式数组身份，页面在静态 JSON 更新后自动刷新。
function replace(target, items) {
  if (Array.isArray(items) && items.length) target.splice(0, target.length, ...items)
}

// 前端只请求本站静态 JSON；请求互斥和冷却覆盖失败路径。
export async function loadContent() {
  if (content.loading) return
  content.loading = true
  content.error = ''
  try {
    const meta = await readJson('meta')
    if (meta.data?.mode === 'production' && Array.isArray(meta.data.modules)) content.meta = meta.data
    const results = await Promise.all(modules.map(async (name) => [name, await readJson(name)]))
    const unavailable = []
    for (const [name, result] of results) {
      try {
        if (result.status !== 'ready') throw new Error('文件不可用')
        content.files[name] = validateData(name, result.data)
      } catch {
        unavailable.push(name)
      }
    }
    if (unavailable.length)
      content.error =
        unavailable.length + ' 个内容文件不可用，保留已加载内容；首次缺失的模块显示标注的草图示例。'
    replace(news, content.files.hotNews?.items)
    replace(songs, content.files.songRank?.dailyTop10)
    replace(words, content.files.englishWord?.words)
    replace(
      poems,
      (content.files.poetry?.poems || (content.files.poetry?.poem ? [content.files.poetry.poem] : [])).map(
        simplifyPoem,
      ),
    )
    replace(
      quizzes,
      content.files.quiz?.items?.map((item) => ({
        ...item,
        answer: typeof item.answer === 'string' ? 'ABCD'.indexOf(item.answer) : item.answer,
      })),
    )
    replace(knowledge, content.files.knowledge?.items)
    if (content.files.food?.today) Object.assign(food, content.files.food.today)
    if (content.files.digital)
      replace(devices, [
        ...content.files.digital.phones.map((item) => ({ ...item, type: 'phone' })),
        ...content.files.digital.laptops.map((item) => ({ ...item, type: 'laptop' })),
      ])
    if (!Object.keys(content.files).length)
      content.error = '尚无可用采集文件，请在项目目录运行 npm run crawler。'
  } catch {
    content.error = '读取内容失败，保留当前已加载的数据。'
  } finally {
    content.loaded = true
    await new Promise((done) => setTimeout(done, 400))
    content.loading = false
  }
}
