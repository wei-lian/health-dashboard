import { Converter } from 'opencc-js/t2cn'

const toSimplified = Converter({ from: 't', to: 'cn' })
const textFields = ['title', 'dynasty', 'author', 'translation', 'appreciation', 'bestLine']

// 统一采集与历史诗词的展示文字，保留收藏 ID、来源链接和原始对象。
export function simplifyPoem(poem) {
  const result = { ...poem }
  for (const field of textFields) {
    if (typeof result[field] === 'string') result[field] = toSimplified(result[field])
  }
  if (Array.isArray(result.content)) result.content = result.content.map(toSimplified)
  if (typeof result.notes === 'string') result.notes = toSimplified(result.notes)
  else if (Array.isArray(result.notes))
    result.notes = result.notes.map((note) => ({
      ...note,
      word: toSimplified(note.word),
      text: toSimplified(note.text),
    }))
  return result
}
