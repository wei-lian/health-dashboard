import { resolve } from 'node:path'
import { request, requestJson, cacheAsset } from './utils/request.js'
import { readJson } from './utils/storage.js'
import { paths, dayIndex } from './utils/paths.js'

// 按 HowToCook 的 Markdown 小节提取用量和步骤，不臆造配料数量。
export function parseRecipe(markdown, url) {
  const section = (title) =>
    new RegExp(`## ${title}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`).exec(markdown)?.[1] || ''
  const ingredients = (section('计算') || section('必备原料和工具'))
    .split('\n')
    .filter((line) => /^\s*[*-] /.test(line))
    .map((line) => [line.replace(/^\s*[*-] /, '').trim(), '按原文'])
  const steps = section('操作')
    .split('\n')
    .filter((line) => /^\s*(?:\d+\.|[*-])\s/.test(line))
    .map((line) => line.replace(/^\s*(?:\d+\.|[*-])\s/, '').trim())
  const description = markdown.split('\n').find((line) => line.trim() && !line.startsWith('#')) || ''
  return {
    name: /^# (.+?)(?:的做法)?\s*$/m.exec(markdown)?.[1] || '家常菜',
    region: 'HowToCook 开放菜谱',
    description: description.slice(0, 160),
    difficulty: /难度[：:]([^\n]+)/.exec(markdown)?.[1]?.trim() || '见原文',
    time: /(?:耗时|约)[^\n。]{0,20}?\d+\s*分钟/.exec(description)?.[0] || '见做法',
    ingredients,
    steps,
    tip: section('附加内容')
      .split('\n')
      .filter((line) => /^\s*[*-] /.test(line))
      .map((line) => line.replace(/^\s*[*-] /, ''))
      .join(' '),
    img: '',
    sourceUrl: url,
  }
}

export async function collect({ targetDate, updatedAt }) {
  const local = await readJson(resolve(paths.data, 'curated.json'))
  let today,
    warning = '',
    mode = 'live'
  try {
    const list = await requestJson(
      'https://api.github.com/repos/Anduin2017/HowToCook/contents/dishes/meat_dish',
    )
    const candidates = list.filter(
      (entry) => entry.type === 'file' && entry.name.endsWith('.md') && entry.download_url,
    )
    if (!candidates.length) throw new Error('菜谱目录为空')
    const entry =
      candidates[((dayIndex(targetDate) % candidates.length) + candidates.length) % candidates.length]
    const markdown = await request(entry.download_url)
    today = parseRecipe(markdown, entry.html_url)
    if (today.steps.length < 4 || today.ingredients.length < 2) throw new Error('菜谱缺少标准用量或步骤')
    const image = /!\[[^\]]*\]\(([^)]+)\)/.exec(markdown)?.[1]
    if (image) {
      try {
        today.img = await cacheAsset(new URL(image, entry.download_url).href)
      } catch {
        warning = '菜谱配图下载失败，显示本地插画。'
      }
    }
  } catch (error) {
    today = { ...local.food, sourceUrl: '', img: '' }
    warning = `网络菜谱不可用，使用本地人工整理菜谱：${error.message}`
    mode = 'curated-fallback'
  }
  const heritage = [
    {
      name: '兰州牛肉面',
      level: '地方饮食文化（非遗级别待官方名录核验）',
      origin: '甘肃省兰州市',
      craft: '经过和、醒、揉、溜、拉等工序手工拉面，搭配清汤、牛肉、白萝卜与香菜蒜苗。',
      story: '面型可随喜好选择，一碗面连接师徒技艺传承与城市日常。',
      source: '本地人工整理，未作为已核验非遗名录发布',
    },
  ]
  return {
    date: targetDate,
    updatedAt,
    source: mode === 'live' ? 'HowToCook 开放菜谱（Unlicense）' : '本地人工整理菜谱',
    mode,
    warning,
    today,
    heritage,
  }
}
