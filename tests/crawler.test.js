import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { chinaDate } from '../crawler/src/utils/paths.js'
import { parseNews } from '../crawler/src/hot-news.js'
import { parseProducts } from '../crawler/src/digital.js'
import { parseRecipe } from '../crawler/src/food.js'
import { aggregateSnapshots } from '../crawler/src/song-rank.js'
import { pickQuestions } from '../crawler/src/quiz.js'
import { validateData } from '../shared/content-schema.js'
import { atomicJson, readJson } from '../crawler/src/utils/storage.js'
import { acquireLock, run } from '../crawler/src/runner.js'

test('北京时间跨日，不依赖进程本地时区', () => {
  assert.equal(chinaDate(new Date('2026-11-18T15:59:59Z')), '2026-11-18')
  assert.equal(chinaDate(new Date('2026-11-18T16:00:00Z')), '2026-11-19')
})

test('新闻只收目标日本站原文，排除外站、其他日期并去重', () => {
  const html = `<a href="/gj/2026/11-18/1.shtml">这是一条国际新闻标题</a>
    <a href="/gj/2026/11-18/1.shtml">相同链接不应重复出现</a>
    <a href="/cj/2026/11-18/2.shtml">这是一条财经新闻标题</a>
    <a href="/gj/2026/11-17/3.shtml">其他日期的新闻标题</a>
    <a href="https://example.com/gj/2026/11-18/4.shtml">外站的新闻标题不可采集</a>`
  const result = parseNews(html, '2026-11-18')
  assert.equal(result.length, 2)
  assert.deepEqual(new Set(result.map((item) => item.category)), new Set(['财经', '国际']))
  assert.ok(result.every((item) => !item.summary && item.url.startsWith('https://www.chinanews.com.cn/')))
})

test('数码只用可见报价；单价如实标注，未定价产品不入库', () => {
  const result = parseProducts(
    `<ul>
    <li><h3><a href="/a.html">手机甲<span>介绍文本</span></a></h3><div class="price-row"><span class="price-type">￥4,999</span><div class="item-b2cprice"><a>￥4899</a></div></div></li>
    <li><h3><a href="/b.html">手机乙</a></h3><div class="price-row"><span class="price-type">￥2999</span></div></li>
    <li><h3><a href="/c.html">手机丙</a></h3><div class="price-row">价格待定</div></li>
    </ul>`,
    'phone',
    5,
  )
  assert.equal(result.length, 2)
  assert.equal(result[0].model, '手机甲')
  assert.equal(result[0].priceMin, 4899)
  assert.equal(result[0].priceMax, 4999)
  assert.equal(result[1].priceRange, '2999（单一报价）')
})

test('菜谱按小节保留原始用量和操作步骤', () => {
  const recipe = parseRecipe(
    '# 番茄炒蛋的做法\n家常菜。\n\n## 必备原料和工具\n- 番茄\n- 鸡蛋\n\n## 计算\n- 番茄 200g\n- 鸡蛋 2 个\n\n## 操作\n1. 切番茄\n2. 打蛋\n3. 炒蛋\n4. 加番茄翻炒\n\n## 附加内容\n- 趁热吃\n',
    'https://example.com/recipe',
  )
  assert.equal(recipe.name, '番茄炒蛋')
  assert.deepEqual(recipe.ingredients[0], ['番茄 200g', '按原文'])
  assert.equal(recipe.steps.length, 4)
  assert.equal(recipe.tip, '趁热吃')
})

test('月年积分只聚合实际日期快照，同日覆盖不重复计分', () => {
  const a = { id: 'a', song: '甲' },
    b = { id: 'b', song: '乙' }
  const snapshots = { '2025-11-01': [b], '2026-10-31': [a], '2026-11-01': [a, b], '2026-11-02': [b, a] }
  const monthly = aggregateSnapshots(snapshots, '2026-11', 20)
  assert.equal(monthly[0].heat, 199)
  assert.equal(monthly[0].days, 2)
  assert.equal(aggregateSnapshots(snapshots, '2026', 100).find((item) => item.id === 'a').heat, 299)
  assert.deepEqual(aggregateSnapshots(snapshots, '2026-01', 20), [])
  snapshots['2026-11-02'] = [a, b]
  assert.equal(aggregateSnapshots(snapshots, '2026-11', 20)[0].heat, 200)
})

test('连续 70 天每天三题，30 天窗口不重复且同日重试不换题', () => {
  const history = {}
  for (let index = 0; index < 70; index++) {
    const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10)
    const selected = pickQuestions(date, history)
    const recent = Object.values(history).slice(-29).flat()
    assert.equal(selected.length, 3)
    assert.ok(selected.every((item) => !recent.includes(item.id)))
    history[date] = selected.map((item) => item.id)
    assert.deepEqual(
      pickQuestions(date, history).map((item) => item.id),
      history[date],
    )
  }
})

test('空列表和损坏契约不能通过写入与页面校验', () => {
  const header = { date: '2026-11-18', updatedAt: '2026-11-19T00:00:00Z', source: '测试' }
  assert.throws(() => validateData('hotNews', { ...header, items: [] }))
  assert.throws(() => validateData('digital', { ...header, phones: [{}], laptops: [] }))
  assert.throws(() =>
    validateData('quiz', {
      ...header,
      items: [{ id: 'x', question: '?', answer: 'Z', explain: '解析', options: ['a', 'b'] }],
    }),
  )
  assert.throws(() =>
    validateData('songRank', {
      ...header,
      currentTop100: [{ id: 'a', song: '甲', artist: '乙', url: 'https://example.com' }],
    }),
  )
})

test('原子写入失败保留旧文件、清理临时文件，损坏 JSON 不静默忽略', async () => {
  const folder = await mkdtemp(resolve(tmpdir(), 'dailydash-storage-'))
  try {
    const file = resolve(folder, 'data.json')
    await atomicJson(file, { version: 1 })
    await assert.rejects(atomicJson(file, { number: 1n }))
    assert.deepEqual(await readJson(file), { version: 1 })
    assert.deepEqual(await readdir(folder), ['data.json'])
    await writeFile(file, '{broken')
    await assert.rejects(readJson(file), SyntaxError)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})

test('进程锁阻止重复运行，释放后可以再次取得', async () => {
  const folder = await mkdtemp(resolve(tmpdir(), 'dailydash-lock-'))
  try {
    const release = await acquireLock(folder)
    await assert.rejects(acquireLock(folder), /正在运行/)
    await release()
    await (
      await acquireLock(folder)
    )()
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})

test('不存在的日历日期在采集开始前被拒绝', async () => {
  await assert.rejects(run({ targetDate: '2026-02-30' }), /--date/)
})
