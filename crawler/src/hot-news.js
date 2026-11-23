import { load } from 'cheerio'
import { createHash } from 'node:crypto'
import { request } from './utils/request.js'

const categories = {
  gj: '国际',
  cj: '财经',
  stock: '财经',
  ty: '体育',
  yl: '娱乐',
  sh: '社会',
  gn: '社会',
  dwq: '社会',
  business: '财经',
  discovery: '科技',
}

// 只取目标日归档的标题与原文地址；不抓取、复制新闻正文。
export function parseNews(html, date) {
  const $ = load(html),
    seen = new Set(),
    items = []
  $('a[href]').each((_, element) => {
    const anchor = $(element)
    let url
    try {
      url = new URL(anchor.attr('href'), 'https://www.chinanews.com.cn').href
    } catch {
      return
    }
    if (
      !url.startsWith('https://www.chinanews.com.cn/') ||
      !url.includes(`/${date.slice(0, 4)}/${date.slice(5)}/`) ||
      !url.endsWith('.shtml')
    )
      return
    const title = anchor.text().replace(/\s+/g, ' ').trim()
    if (title.length < 8 || seen.has(url)) return
    seen.add(url)
    const category = categories[new URL(url).pathname.split('/')[1]] || '社会'
    items.push({
      id: createHash('sha1').update(url).digest('hex').slice(0, 14),
      title,
      summary: '',
      category,
      source: '中国新闻网',
      time: date,
      url,
    })
  })
  // 尽量覆盖不同分类；这里是编辑精选，不冒充热度排名。
  const selected = []
  for (const category of ['科技', '社会', '财经', '国际', '体育', '娱乐']) {
    const item = items.find((entry) => entry.category === category)
    if (item) selected.push(item)
  }
  return [...selected, ...items.filter((item) => !selected.includes(item))].slice(0, 8)
}

export async function collect({ targetDate, updatedAt }) {
  const url = `https://www.chinanews.com.cn/scroll-news/${targetDate.slice(0, 4)}/${targetDate.slice(5).replace('-', '')}/news.shtml`
  return {
    date: targetDate,
    updatedAt,
    source: '中国新闻网 · 公开昨日归档',
    sourceUrl: url,
    mode: 'live',
    notice: '按分类精选昨日新闻标题，不是全网热搜排名；来源未提供摘要时只展示标题。',
    items: parseNews(await request(url), targetDate),
  }
}
