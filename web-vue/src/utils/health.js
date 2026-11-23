// 用本地日历日期保存记录，避免 UTC 换日影响。
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 跨午夜计算睡眠；同一时间视为零分钟，由表单提示修正。
export function sleepMinutes(bed, wake) {
  const toMinutes = (value) =>
    value.split(':').reduce((hours, minutes) => Number(hours) * 60 + Number(minutes))
  return (toMinutes(wake) - toMinutes(bed) + 1440) % 1440
}

// 根据时长生成确定性通用睡眠提示。
export function sleepAdvice(minutes) {
  if (!minutes)
    return { title: '先记录昨晚的睡眠吧', detail: '规律作息，从了解自己的睡眠开始。', tone: 'neutral' }
  if (minutes < 360)
    return { title: '昨晚睡得有点少', detail: '今天避免高强度运动，注意控制咖啡因摄入。', tone: 'warning' }
  if (minutes < 420)
    return { title: '再多睡一小会儿', detail: '今晚试着提前 30–45 分钟入睡。', tone: 'warning' }
  if (minutes <= 540)
    return { title: '睡得不错，继续保持', detail: '睡眠时长达标，规律的作息值得坚持。', tone: 'good' }
  if (minutes > 600)
    return { title: '昨晚的睡眠比较长', detail: '留意近期疲劳情况，尝试维持规律作息。', tone: 'warning' }
  return { title: '昨晚休息得比较充分', detail: '留意白天精神状态，保持规律作息。', tone: 'neutral' }
}

// 计算截至今天或昨天的连续运动打卡天数。
export function streakDays(records, now = new Date()) {
  const dates = new Set(records.map((record) => record.date))
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!dates.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (dates.has(localDate(cursor))) {
    count++
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}
