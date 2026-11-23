import { load } from 'cheerio'
import { resolve } from 'node:path'
import { request, cacheAsset } from './utils/request.js'
import { paths, dayIndex } from './utils/paths.js'
import { readJson } from './utils/storage.js'

// 从科技馆公开文章中抽取短节选并保留来源，不生成未经校验的科学结论。
export async function collect({ targetDate, updatedAt }) {
  let items,
    mode = 'live',
    warning = ''
  try {
    const $ = load(await request('https://www.cdstm.cn/'))
    const seen = new Set()
    const links = $('a[href]')
      .map((_, element) => ({
        title: $(element).text().replace(/\s+/g, ' ').trim(),
        url: new URL($(element).attr('href'), 'https://www.cdstm.cn').href,
      }))
      .get()
      .filter((entry) => {
        if (
          !entry.url.startsWith('https://www.cdstm.cn/') ||
          !/\/art\/\d{4}\/art_/.test(entry.url) ||
          /\/videos\//.test(entry.url) ||
          entry.title.length < 10 ||
          entry.title.length > 65 ||
          seen.has(entry.url)
        )
          return false
        seen.add(entry.url)
        return true
      })
    if (!links.length) throw new Error('科普文章列表结构已变化')
    const entry = links[((dayIndex(targetDate) % links.length) + links.length) % links.length]
    const article = load(await request(entry.url))
    const paragraphs = article('p')
      .map((_, element) => article(element).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter((text) => text.length >= 30 && !/版权所有|ICP备|联系我们|责任编辑/.test(text))
    const body = paragraphs.join('\n\n').slice(0, 500)
    if (body.length < 100) throw new Error('该内容为视频或缺少可读文字')
    let img = ''
    const image = article('p img').first().attr('src')
    if (image) {
      try {
        img = await cacheAsset(new URL(image, entry.url).href)
      } catch {
        /* 使用本地配色插画。 */
      }
    }
    items = [
      {
        id: new URL(entry.url).pathname.split('/').pop(),
        category: '科普阅读',
        title: entry.title,
        intro: '中国数字科技馆 · 原文节选',
        body,
        fact: '',
        img,
        ref: '中国数字科技馆（原文节选，非 AI 改写）',
        url: entry.url,
      },
    ]
  } catch (error) {
    const local = await readJson(resolve(paths.data, 'curated.json'))
    const item =
      local.knowledge[
        ((dayIndex(targetDate) % local.knowledge.length) + local.knowledge.length) % local.knowledge.length
      ]
    items = [
      {
        ...item,
        id: `curated-${dayIndex(targetDate) % local.knowledge.length}`,
        ref: '本地人工整理科普卡片',
        url: '',
      },
    ]
    mode = 'curated-fallback'
    warning = `科技馆采集不可用，显示本地整理内容：${error.message}`
  }
  return {
    date: targetDate,
    updatedAt,
    source: mode === 'live' ? '中国数字科技馆' : '本地人工整理科普',
    mode,
    warning,
    items,
  }
}
