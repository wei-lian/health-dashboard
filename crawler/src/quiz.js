import { resolve } from 'node:path'
import bank from '../data/question-bank.js'
import { readJson, atomicJson } from './utils/storage.js'
import { paths, dayIndex } from './utils/paths.js'

// 日期轮转配合 30 天使用记录，同一天重跑返回原题，跨日避免重复。
export function pickQuestions(date, history, pool = bank) {
  const assigned = history[date]?.map((id) => pool.find((item) => item.id === id)).filter(Boolean)
  if (assigned?.length === 3) return assigned
  const cutoff = new Date(Date.parse(`${date}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10)
  const used = new Set(
    Object.entries(history)
      .filter(([day]) => day > cutoff && day < date)
      .flatMap(([, ids]) => ids),
  )
  const offset = (((dayIndex(date) * 3) % pool.length) + pool.length) % pool.length
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)].filter((item) => !used.has(item.id))
  if (rotated.length < 3) throw new Error('30 天内可用新题不足，请补充 crawler/data/question-bank.js')
  return rotated.slice(0, 3)
}

export async function collect({ targetDate, updatedAt }) {
  const file = resolve(paths.state, 'quiz-history.json')
  const history = await readJson(file, {})
  const selected = pickQuestions(targetDate, history)
  history[targetDate] = selected.map((item) => item.id)
  const keepFrom = new Date(Date.parse(`${targetDate}T00:00:00Z`) - 32 * 86400000).toISOString().slice(0, 10)
  for (const day of Object.keys(history)) if (day < keepFrom) delete history[day]
  await atomicJson(file, history)
  const items = selected.map((item, index) => {
    const options = [...item.distractors]
    const position = (dayIndex(targetDate) + index) % 4
    options.splice(position, 0, item.correct)
    return {
      id: `${targetDate}:${item.id}`,
      questionId: item.id,
      type: 'single',
      category: item.category,
      question: item.question,
      options,
      answer: 'ABCD'[position],
      explain: item.explain,
      knowledge: item.knowledge,
    }
  })
  return {
    date: targetDate,
    updatedAt,
    source: `本地原创校对题库 · ${bank.length} 题 · 30 天不重复`,
    mode: 'curated',
    items,
  }
}
