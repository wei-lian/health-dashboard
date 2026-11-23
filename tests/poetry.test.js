import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simplifyPoem } from '../shared/poetry.js'

test('截图中的繁体诗词、译注与名句统一简体，收藏标识和来源保持一致', () => {
  const original = {
    id: '秋登蘭山-56ca5b29',
    title: '秋登蘭山寄張五',
    dynasty: '唐',
    author: '孟浩然',
    content: [
      '北山白雲裏，隱者自怡悅。',
      '相望試登高，心飛逐鳥滅。',
      '愁因薄暮起，興是清秋發。',
      '時見歸村人，沙行渡頭歇。',
      '天邊樹若薺，江畔舟如月。',
      '何當載酒來，共醉重陽節。',
    ],
    bestLine: '北山白雲裏，隱者自怡悅。',
    translation: '北山白雲裏的隱者。',
    notes: [{ word: '薺', text: '薺菜。' }],
    appreciation: '詩中寫出了秋興。',
    sourceUrl: 'https://example.com/蘭山',
  }
  const snapshot = structuredClone(original)
  const poem = simplifyPoem(original)
  assert.equal(poem.title, '秋登兰山寄张五')
  assert.deepEqual(poem.content, [
    '北山白云里，隐者自怡悦。',
    '相望试登高，心飞逐鸟灭。',
    '愁因薄暮起，兴是清秋发。',
    '时见归村人，沙行渡头歇。',
    '天边树若荠，江畔舟如月。',
    '何当载酒来，共醉重阳节。',
  ])
  assert.equal(poem.bestLine, poem.content[0])
  assert.equal(poem.translation, '北山白云里的隐者。')
  assert.deepEqual(poem.notes, [{ word: '荠', text: '荠菜。' }])
  assert.equal(poem.appreciation, '诗中写出了秋兴。')
  assert.equal(poem.id, original.id)
  assert.equal(poem.sourceUrl, original.sourceUrl)
  assert.deepEqual(original, snapshot)
  assert.deepEqual(simplifyPoem(poem), poem)
})

test('兼容本地诗集的字符串注释、繁体作者及空注释', () => {
  const poem = simplifyPoem({ author: '王維', notes: '詩中鳥鳴。' })
  assert.equal(poem.author, '王维')
  assert.equal(poem.notes, '诗中鸟鸣。')
  assert.deepEqual(simplifyPoem({ notes: [] }).notes, [])
})
