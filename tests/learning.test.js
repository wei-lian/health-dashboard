import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dailyStudy, scheduleWord, wordQueue, recordWordPractice } from '../shared/learning.js'
import {
  emptyPersonalData,
  validatePersonalData,
  mergePersonalData,
  hasPersonalContent,
  parsePersonalBackup,
} from '../shared/personal-schema.js'
import { createPersonalStorage } from '../server/personal-storage.js'
import { publicAssetUrl } from '../web-vue/src/utils/deployment.js'

test('本地词库至少 5000 个独立单词，每个词都有音标、中文释义、真实双语例句和原始信息', async () => {
  const data = JSON.parse(
    await readFile(new URL('../web-vue/public/library/vocabulary.json', import.meta.url), 'utf8'),
  )
  assert.ok(data.words.length >= 5000)
  assert.equal(data.count, data.words.length)
  assert.equal(new Set(data.words.map((i) => i.w)).size, data.words.length)
  for (const word of data.words) {
    for (const key of ['id', 'w', 'phonetic', 'cn', 'eg', 'egCn', 'source', 'book'])
      assert.ok(word[key]?.trim(), `${word.w}: ${key}`)
    assert.ok(word.sentences.length > 0)
    assert.equal(word.eg, word.sentences[0].en)
    assert.ok(word.detail.trans.length)
    assert.ok(word.detail.sentence.sentences.some((s) => s.sContent === word.eg && s.sCn === word.egCn))
  }
  assert.equal(
    publicAssetUrl('/library/vocabulary.json', '/health-dashboard/'),
    '/health-dashboard/library/vocabulary.json',
  )
})

test('记忆评分跨月安排复习，忘词当天重练，熟练后仍保留复习', () => {
  const first = scheduleWord(null, 'apple', 'remember', '2026-11-30', 'I ate an apple.')
  assert.equal(first.nextReview, '2026-12-01')
  assert.equal(first.level, 1)
  const second = scheduleWord(first, 'apple', 'remember', '2026-12-01', first.sentence)
  assert.equal(second.nextReview, '2026-12-04')
  const forgot = scheduleWord(second, 'apple', 'again', '2026-12-04', first.sentence)
  assert.equal(forgot.nextReview, '2026-12-04')
  assert.equal(forgot.level, 0)
  assert.equal(forgot.firstDate, '2026-11-30')
  assert.equal(forgot.attempts, 3)
  assert.equal(forgot.sentence, 'I ate an apple.')
  assert.throws(() => scheduleWord(first, 'apple', 'invalid', '2026-12-01'))
})

test('每日新词额度、到期和逾期复习、跨日记录均独立计算', () => {
  const words = ['apple', 'book', 'cat', 'dog'].map((w) => ({ w }))
  const progress = [scheduleWord(null, 'apple', 'remember', '2026-11-23')]
  const plan = { dailyNew: 2 }
  const history = [{ id: '2026-11-24', newWords: ['book'], reviewedWords: [], poems: [] }]
  assert.deepEqual(
    wordQueue(words, progress, history, plan, '2026-11-24').map((i) => i.w),
    ['book'],
  )
  assert.deepEqual(
    wordQueue(words, progress, history, plan, '2026-11-24', 'review').map((i) => i.w),
    ['apple'],
  )
  assert.deepEqual(wordQueue(words, progress, history, plan, '2026-11-23', 'review'), [])
  assert.deepEqual(
    wordQueue(words, progress, history, plan, '2026-11-25', 'review').map((i) => i.w),
    ['apple'],
  )
  assert.equal(dailyStudy(history, '2026-11-25').newWords.length, 0)
})

test('忘记不算完成复习，当天新词重练后分别去重计数', () => {
  const date = '2026-11-24'
  const first = recordWordPractice([], null, 'apple', 'again', date)
  assert.deepEqual(first.newWords, ['apple'])
  assert.deepEqual(first.reviewedWords, [])
  const progress = scheduleWord(null, 'apple', 'again', date)
  const repeated = recordWordPractice([first], progress, 'apple', 'again', date)
  assert.deepEqual(repeated.newWords, ['apple'])
  assert.deepEqual(repeated.reviewedWords, [])
  const remembered = recordWordPractice([repeated], progress, 'apple', 'remember', date)
  assert.deepEqual(remembered.newWords, ['apple'])
  assert.deepEqual(remembered.reviewedWords, ['apple'])
  const forgotten = recordWordPractice([remembered], progress, 'apple', 'again', date)
  assert.deepEqual(forgotten.reviewedWords, [])
  assert.deepEqual(remembered.reviewedWords, ['apple'])
})

test('旧备份补齐学习字段，非法目标、记录和待办均拒绝，迁移识别仅有学习计划的数据', () => {
  const old = emptyPersonalData()
  for (const key of ['learningPlan', 'wordProgress', 'studyHistory', 'listeningLogs', 'todos'])
    delete old[key]
  const restored = parsePersonalBackup({ version: 2, data: old })
  assert.equal(restored.learningPlan.dailyNew, 20)
  assert.equal(restored.todos.length, 0)
  for (const dailyNew of [0, 201, 1.5, NaN])
    assert.throws(() =>
      validatePersonalData({ ...restored, learningPlan: { ...restored.learningPlan, dailyNew } }),
    )
  assert.throws(() =>
    validatePersonalData({
      ...restored,
      todos: [
        { id: 'one', title: 'test', date: '2026-02-30', category: 'personal', target: 1, completed: 0 },
      ],
    }),
  )
  assert.throws(() =>
    validatePersonalData({
      ...restored,
      listeningLogs: [{ id: 'one', title: 'test', date: '2026-11-24', minutes: 0 }],
    }),
  )
  assert.ok(hasPersonalContent({ ...restored, learningPlan: { ...restored.learningPlan, dailyNew: 30 } }))
})

test('学习计划、复习、听力和待办实际写盘，合并备份保留本机记录并去重每日进度', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dailydash-learning-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPersonalStorage(directory)
  const data = emptyPersonalData()
  data.learningPlan.dailyNew = 30
  data.wordProgress = [scheduleWord(null, 'apple', 'remember', '2026-11-24', 'An apple a day.')]
  data.studyHistory = [{ id: '2026-11-24', newWords: ['apple'], reviewedWords: [], poems: ['poem-1'] }]
  data.listeningLogs = [
    { id: 'listen-1', title: 'Morning', date: '2026-11-24', minutes: 10, source: '本地短文', note: '已跟读' },
  ]
  data.todos = [
    {
      id: 'todo-1',
      title: '读书',
      date: '2026-11-24',
      category: 'personal',
      target: 2,
      completed: 1,
      note: '',
    },
  ]
  await storage.save(data, 0)
  const saved = (await storage.read()).data
  assert.deepEqual(saved, validatePersonalData(data))
  const incoming = structuredClone(data)
  incoming.wordProgress[0].sentence = 'old sentence'
  incoming.studyHistory[0].newWords.push('book')
  const merged = mergePersonalData(saved, incoming)
  assert.equal(merged.wordProgress[0].sentence, 'An apple a day.')
  assert.deepEqual(merged.studyHistory[0].newWords, ['apple', 'book'])
  assert.equal(merged.todos.length, 1)
  assert.equal(merged.listeningLogs.length, 1)
  assert.equal(mergePersonalData(emptyPersonalData(), incoming).learningPlan.dailyNew, 30)
})
