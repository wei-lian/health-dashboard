import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyPersonalData } from '../shared/personal-schema.js'
import { generateInsights, durationText } from '../web-vue/src/utils/personal-insights.js'
import { chooseMeal } from '../web-vue/src/utils/meals.js'

const now = new Date('2026-11-19T12:00:00+08:00')
const night = (date, duration, bed = '23:00') => ({
  id: date,
  date,
  duration,
  bed,
  wake: '07:00',
  quality: 4,
})

test('空白或过期记录不编造活动量、睡眠均值或今日恢复结论', () => {
  const data = emptyPersonalData()
  data.sleeps = [night('2026-11-01', 200), night('2026-11-20', 300)]
  const result = generateInsights(data, now)
  assert.equal(result.averageSleep, null)
  assert.equal(result.sportMinutes, 0)
  assert.equal(result.sleepNights, 0)
  assert.match(result.recommendations[0].evidence, /无法据此判断/)
  assert.ok(!result.recommendations.some((item) => item.id === 'recovery'))
})

test('均值只计算实际夜晚，建议随真实数据变化并标明缺失天数', () => {
  const data = emptyPersonalData()
  data.sleeps = [night('2026-11-18', 300), night('2026-11-19', 360)]
  const first = generateInsights(data, now)
  assert.equal(first.averageSleep, 330)
  assert.match(first.recommendations.find((item) => item.id === 'sleep').evidence, /5 晚未填写/)
  assert.equal(first.recommendations.find((item) => item.id === 'sleep').title, '优先补足睡眠机会')
  data.sleeps[0].duration = 540
  data.sleeps[1].duration = 480
  const next = generateInsights(data, now)
  assert.equal(next.averageSleep, 510)
  assert.equal(next.recommendations.find((item) => item.id === 'sleep').title, '已记录夜晚的均值在常见范围')
  assert.equal(durationText(419.7), '7 小时 0 分钟')
})

test('跨午夜作息不误判；仅最近一晚短睡眠才触发当天运动调整', () => {
  const data = emptyPersonalData()
  data.sleeps = [
    night('2026-11-17', 450, '23:30'),
    night('2026-11-18', 450, '00:00'),
    night('2026-11-19', 330, '00:15'),
  ]
  let result = generateInsights(data, now)
  assert.ok(!result.recommendations.some((item) => item.id === 'regularity'))
  assert.match(result.recommendations.find((item) => item.id === 'recovery').evidence, /2026-11-19/)
  data.sleeps = [night('2026-11-15', 300)]
  result = generateInsights(data, now)
  assert.equal(result.recommendations.find((item) => item.id === 'recovery').title, '先补最近的睡眠记录')
})

test('运动建议使用实填次数、强度、时长；不把未填日期算作没有运动', () => {
  const data = emptyPersonalData()
  data.sports = [
    { date: '2026-11-19', duration: 30, intensity: '吃力' },
    { date: '2026-11-19', duration: 20, intensity: '轻松' },
    { date: '2026-11-20', duration: 999 },
  ]
  const result = generateInsights(data, now)
  assert.equal(result.sportMinutes, 50)
  assert.equal(result.activeDays, 1)
  assert.match(result.recommendations[0].evidence, /2 次、1 天，共 50 分钟/)
  assert.match(result.recommendations[0].evidence, /吃力」30 分钟/)
  assert.match(result.recommendations[0].action, /未记录的日期不视为没有运动/)
  assert.ok(!result.recommendations.some((item) => item.id === 'trend'))
})

test('外卖仅从启用类型抽签，多类型避免连续重复，单类型可重复，无候选有提示', () => {
  const types = [
    { id: 'one', enabled: true },
    { id: 'two', enabled: true },
    { id: 'off', enabled: false },
  ]
  assert.equal(chooseMeal(types, 'one', () => 0).id, 'two')
  assert.equal(chooseMeal(types, 'two', () => 0.99).id, 'one')
  assert.equal(chooseMeal(types.slice(0, 1), 'one').id, 'one')
  assert.throws(() => chooseMeal([{ enabled: false }]), /启用或新增/)
})
