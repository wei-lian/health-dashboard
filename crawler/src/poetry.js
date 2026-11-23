import { resolve } from 'node:path'
import { requestJson } from './utils/request.js'
import { readJson } from './utils/storage.js'
import { paths, dayIndex } from './utils/paths.js'
import { simplifyPoem } from '../../shared/poetry.js'

const sourceUrl =
  'https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/全唐诗/唐诗三百首.json'

// 公版诗词原文来自开放诗集，译文仅使用已人工整理的对应内容。
export async function collect({ targetDate, updatedAt }) {
  const local = await readJson(resolve(paths.data, 'curated.json'))
  let poems,
    warning = '',
    mode = 'live'
  try {
    const all = await requestJson(sourceUrl)
    if (!Array.isArray(all) || all.length < 100) throw new Error('诗集结构异常')
    const offset = (((dayIndex(targetDate) * 3) % all.length) + all.length) % all.length
    poems = Array.from({ length: 3 }, (_, index) => {
      const poem = all[(offset + index) % all.length]
      return {
        id: poem.id,
        title: poem.title,
        dynasty: '唐',
        author: poem.author,
        content: poem.paragraphs,
        notes: [],
        translation: '该开放来源仅提供原文，尚未配人工译文。',
        appreciation: '可先阅读原文，译文与赏析将在核对后补充。',
        bestLine: poem.paragraphs[0],
        sourceUrl: 'https://github.com/chinese-poetry/chinese-poetry',
      }
    })
  } catch (error) {
    if (local.poems.length < 1) throw error
    poems = local.poems
    warning = `网络诗集不可用，使用人工整理诗集：${error.message}`
    mode = 'curated-fallback'
  }
  poems = poems.map(simplifyPoem)
  return {
    date: targetDate,
    updatedAt,
    source: mode === 'live' ? 'chinese-poetry · 唐诗三百首（古籍原文）' : '本地人工整理诗集',
    mode,
    warning,
    sourceUrl,
    poems,
    poem: poems[0],
  }
}
