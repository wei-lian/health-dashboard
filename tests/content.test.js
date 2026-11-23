import { test } from 'node:test'
import assert from 'node:assert/strict'

test('刷新请求互斥，坏文件和断网不覆盖已加载内容，失败后可以再刷新', async () => {
  const original = globalThis.fetch
  let calls = 0,
    broken = false
  const header = { date: '2026-11-18', updatedAt: '2026-11-19T00:00:00Z', source: '测试' }
  const traditionalPoem = {
    id: 'poem-1',
    title: '秋登蘭山寄張五',
    author: '孟浩然',
    content: ['北山白雲裏，隱者自怡悅。'],
    bestLine: '北山白雲裏，隱者自怡悅。',
  }
  globalThis.fetch = async (url) => {
    calls++
    if (broken) throw new Error('offline')
    const data = url.includes('englishWord')
      ? {
          date: '2026-11-18',
          updatedAt: '2026-11-19T00:00:00Z',
          source: '测试词表',
          words: [{ w: 'test', cn: '测试', eg: 'This is a test.' }],
        }
      : url.includes('poetry')
        ? { ...header, poem: traditionalPoem, ...(calls <= 9 ? { poems: [traditionalPoem] } : {}) }
        : {}
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const { loadContent, content, words, poems } = await import('../web-vue/src/stores/content-store.js')
    const first = loadContent()
    await loadContent()
    await first
    assert.equal(calls, 9)
    assert.equal(words[0].w, 'test')
    assert.equal(Object.keys(content.files).length, 2)
    assert.equal(poems[0].title, '秋登兰山寄张五')
    assert.equal(poems[0].content[0], '北山白云里，隐者自怡悦。')
    assert.equal(poems[0].bestLine, poems[0].content[0])
    assert.equal(poems[0].id, traditionalPoem.id)
    broken = true
    await loadContent()
    assert.equal(words[0].w, 'test')
    assert.equal(poems[0].title, '秋登兰山寄张五')
    assert.match(content.error, /不可用/)
    assert.equal(content.loading, false)
    broken = false
    await loadContent()
    assert.equal(content.loading, false)
    assert.equal(calls, 27)
    assert.equal(poems[0].title, '秋登兰山寄张五')
    assert.equal(content.files.poetry.poems, undefined)
  } finally {
    globalThis.fetch = original
  }
})
