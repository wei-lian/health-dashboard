import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sleepMinutes, sleepAdvice, streakDays, localDate } from '../web-vue/src/utils/health.js'

test('跨午夜、同日和零时长睡眠计算', () => {
  assert.equal(sleepMinutes('23:40', '07:10'), 450)
  assert.equal(sleepMinutes('13:00', '14:30'), 90)
  assert.equal(sleepMinutes('07:00', '07:00'), 0)
})
test('睡眠建议关键阈值覆盖', () => {
  assert.equal(sleepAdvice(0).tone, 'neutral')
  assert.equal(sleepAdvice(359).title, '昨晚睡得有点少')
  assert.equal(sleepAdvice(360).title, '再多睡一小会儿')
  assert.equal(sleepAdvice(420).tone, 'good')
  assert.equal(sleepAdvice(540).tone, 'good')
  assert.equal(sleepAdvice(600).tone, 'neutral')
  assert.equal(sleepAdvice(601).tone, 'warning')
})
test('打卡跨月并忽略同日多条记录', () => {
  const now = new Date(2026, 10, 2)
  assert.equal(
    streakDays(
      [{ date: '2026-11-02' }, { date: '2026-11-02' }, { date: '2026-11-01' }, { date: '2026-10-31' }],
      now,
    ),
    3,
  )
  assert.equal(streakDays([{ date: '2026-11-01' }, { date: '2026-10-31' }], now), 2)
  assert.equal(streakDays([{ date: '2026-10-31' }], now), 0)
})
test('本地日期格式稳定', () => {
  assert.equal(localDate(new Date(2026, 0, 2)), '2026-01-02')
})
