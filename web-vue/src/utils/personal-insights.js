import { localDate } from './health.js'

const shiftDate = (date, offset) =>
  new Date(Date.parse(date + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
export const durationText = (minutes) => {
  const rounded = Math.round(minutes)
  return `${Math.floor(rounded / 60)} 小时 ${rounded % 60} 分钟`
}

// 只用已记录日期计算，不补造未填写的睡眠或运动；每条建议附触发依据。
export function generateInsights(data, now = new Date()) {
  const today = localDate(now),
    start = shiftDate(today, -6),
    previousStart = shiftDate(today, -13)
  const sports = data.sports.filter((item) => item.date >= start && item.date <= today)
  const previousSports = data.sports.filter((item) => item.date >= previousStart && item.date < start)
  const sleeps = [...data.sleeps]
    .filter((item) => item.date >= start && item.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
  const activeDays = new Set(sports.map((item) => item.date)).size
  const sportMinutes = sports.reduce((sum, item) => sum + item.duration, 0)
  const averageSleep = sleeps.length
    ? Math.round(sleeps.reduce((sum, item) => sum + item.duration, 0) / sleeps.length)
    : null
  const shortNights = sleeps.filter((item) => item.duration < 420).length
  const lowQuality = sleeps.filter((item) => item.quality <= 2).length
  const latest = sleeps[0],
    freshSleep = latest && latest.date >= shiftDate(today, -1)
  const recommendations = []
  const add = (id, title, evidence, action, tone = 'neutral') =>
    recommendations.push({ id, title, evidence, action, tone })

  if (!sports.length)
    add(
      'activity',
      '先建立可用的活动记录',
      '近 7 天未填写运动，无法据此判断你有没有运动。',
      '从下一次实际运动开始记录时长和强度。若平时活动较少，可以先安排一次 10–15 分钟轻松步行，再按体感增加。',
    )
  else {
    const longest = Math.max(...sports.map((item) => item.duration))
    const hardMinutes = sports
      .filter((item) => item.intensity === '吃力')
      .reduce((sum, item) => sum + item.duration, 0)
    add(
      'activity',
      activeDays <= 2 ? '把活动分散到更多日期' : '保持节奏，逐步增加活动',
      `近 7 天已记录 ${sports.length} 次、${activeDays} 天，共 ${sportMinutes} 分钟；其中自评「吃力」${hardMinutes} 分钟，单次最长 ${longest} 分钟。`,
      activeDays <= 2
        ? '下周可尝试把原有运动分散到 3 天，先保持每次容易坚持的时长；未记录的日期不视为没有运动。'
        : longest >= 90
          ? '长时间运动后留意疲劳与肌肉酸痛，下一次可安排轻松活动，避免突然加量。'
          : '继续保持已有频率，若恢复良好再小幅增加时长；力量训练与有氧活动可以交替安排。',
    )
    if (new Set(previousSports.map((item) => item.date)).size >= 3 && activeDays >= 3) {
      const previous = previousSports.reduce((sum, item) => sum + item.duration, 0),
        delta = sportMinutes - previous
      add(
        'trend',
        '看看两周记录的变化',
        `本周记录 ${sportMinutes} 分钟，前 7 天记录 ${previous} 分钟，相差 ${delta >= 0 ? '+' : ''}${delta} 分钟。`,
        '这反映已填写记录的变化，记录覆盖天数不同会影响比较；结合疲劳、疼痛和恢复情况决定是否调整计划。',
      )
    }
  }
  if (!sleeps.length)
    add(
      'sleep',
      '睡眠数据还不足',
      '近 7 天没有已保存的睡眠记录，不生成睡眠均值或达标结论。',
      '先记录起床日期、入睡与起床时间，并尽量填写实际睡眠时长和主观质量；连续记录几晚后建议会更具体。',
    )
  else {
    const evidence = `近 7 天已记录 ${sleeps.length} 晚，均值 ${durationText(averageSleep)}；其中 ${shortNights} 晚少于 7 小时，${lowQuality} 晚主观质量较差。${7 - sleeps.length} 晚未填写，未参与均值。`
    add(
      'sleep',
      averageSleep < 420
        ? '优先补足睡眠机会'
        : averageSleep <= 540
          ? '已记录夜晚的均值在常见范围'
          : '留意较长睡眠后的精神状态',
      evidence,
      averageSleep < 420
        ? '可先尝试把睡前准备提前 15–30 分钟，保持起床时间相对固定；如果持续睡不好或白天明显困倦，建议咨询医生。'
        : averageSleep <= 540
          ? '一般成年人常见参考为 7–9 小时。继续观察白天精神状态与睡眠质量；均值不能说明每晚都充足，也不能代替未填写日期。'
          : '较长睡眠可能与补觉或个体差异有关，单靠时长无法判断原因。若持续疲劳或日间嗜睡，可寻求专业评估。',
      averageSleep < 420 ? 'attention' : 'neutral',
    )
    if (sleeps.length >= 3) {
      const bedtimes = sleeps.map((item) => {
        const [h, m] = item.bed.split(':').map(Number)
        const value = h * 60 + m
        return value < 720 ? value + 1440 : value
      })
      const spread = Math.max(...bedtimes) - Math.min(...bedtimes)
      if (spread >= 90)
        add(
          'regularity',
          '让入睡时间更稳定一点',
          `${sleeps.length} 晚的入睡时间跨度约 ${spread} 分钟，已处理跨午夜时间。`,
          '可以先把睡前准备安排在相近时段，逐步缩小作息波动；轮班、午睡等特殊情况需要结合实际安排判断。',
        )
    }
    if (freshSleep && latest.duration < 360)
      add(
        'recovery',
        '今天按精神状态调整强度',
        `最近一晚（${latest.date}）记录睡眠 ${durationText(latest.duration)}，少于 6 小时。`,
        '若今天困倦或疲劳，优先休息和轻松活动，暂缓高强度或需要高度专注的运动；清醒和恢复良好后再按计划训练。',
        'attention',
      )
    else if (!freshSleep)
      add(
        'recovery',
        '先补最近的睡眠记录',
        `最近一条睡眠是 ${latest.date}，不能代表昨晚。`,
        '补上最近一晚后，再结合今天的精神状态决定运动强度；不使用旧记录推断今天是否需要恢复。',
      )
    else if (lowQuality)
      add(
        'recovery',
        '时长之外也看看睡眠质量',
        `已记录夜晚中有 ${lowQuality} 晚质量为 1–2 星。`,
        '观察夜间醒来、咖啡因摄入和白天困倦情况；主观质量持续较差时，可带着这些记录咨询医生。',
      )
  }
  return {
    start,
    end: today,
    activeDays,
    sportMinutes,
    sleepNights: sleeps.length,
    averageSleep,
    shortNights,
    recommendations,
  }
}
