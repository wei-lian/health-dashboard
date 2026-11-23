export const defaultMealTypes = [
  { id: 'rice', name: '盖浇饭 / 简餐', enabled: true },
  { id: 'noodles', name: '面食 / 米粉', enabled: true },
  { id: 'salad', name: '轻食 / 沙拉', enabled: true },
  { id: 'dumpling', name: '饺子 / 馄饨', enabled: true },
  { id: 'stir-fry', name: '家常小炒', enabled: true },
  { id: 'japanese', name: '日式 / 韩式', enabled: true },
]

// 每次返回独立初始数据，避免默认菜单被其他实例修改。
export function emptyPersonalData() {
  return {
    sports: [],
    sleeps: [],
    favorites: [],
    mastered: [],
    answers: {},
    readNews: [],
    mealTypes: structuredClone(defaultMealTypes),
    mealHistory: [],
  }
}

const text = (value, max = 120) => typeof value === 'string' && value.length > 0 && value.length <= max
const calendarDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
const clock = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// 前后端共用严格白名单，旧版备份自动补齐菜单字段，不接受任意对象写入磁盘。
export function validatePersonalData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('个人数据格式不正确')
  const result = emptyPersonalData()
  for (const key of ['sports', 'sleeps']) {
    if (!Array.isArray(input[key]) || input[key].length > 20000)
      throw new Error(`${key} 记录格式或数量不正确`)
    const ids = new Set(),
      dates = new Set()
    result[key] = input[key].map((item) => {
      if (
        !item ||
        !text(item.id) ||
        ids.has(item.id) ||
        !calendarDate(item.date) ||
        !Number.isFinite(item.duration) ||
        item.duration < 1 ||
        item.duration > (key === 'sports' ? 600 : 1440)
      )
        throw new Error('健康记录包含重复 ID、无效日期或时长')
      ids.add(item.id)
      if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500))
        throw new Error('备注格式不正确')
      const record = { id: item.id, date: item.date, duration: item.duration, note: item.note || '' }
      if (key === 'sports') {
        if (
          !text(item.type, 40) ||
          (item.intensity !== undefined && !['轻松', '适中', '吃力'].includes(item.intensity))
        )
          throw new Error('运动类型或强度不正确')
        return { ...record, type: item.type, intensity: item.intensity || '适中' }
      }
      if (
        !clock(item.bed) ||
        !clock(item.wake) ||
        dates.has(item.date) ||
        (item.quality !== undefined &&
          (!Number.isInteger(Number(item.quality)) || Number(item.quality) < 1 || Number(item.quality) > 5))
      )
        throw new Error('睡眠时间、质量或日期不正确，同日仅保留一条')
      dates.add(item.date)
      return { ...record, bed: item.bed, wake: item.wake, quality: Number(item.quality ?? 4) }
    })
  }
  for (const key of ['favorites', 'mastered', 'readNews']) {
    if (
      !Array.isArray(input[key]) ||
      input[key].length > 30000 ||
      !input[key].every((item) => text(item, 200))
    )
      throw new Error('收藏或学习状态格式不正确')
    result[key] = [...new Set(input[key])]
  }
  if (
    !input.answers ||
    typeof input.answers !== 'object' ||
    Array.isArray(input.answers) ||
    Object.keys(input.answers).length > 30000 ||
    !Object.entries(input.answers).every(
      ([id, value]) =>
        text(id, 200) &&
        !['__proto__', 'constructor', 'prototype'].includes(id) &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 3,
    )
  )
    throw new Error('答题状态格式不正确')
  result.answers = Object.fromEntries(Object.entries(input.answers))
  if (input.mealTypes !== undefined) {
    if (!Array.isArray(input.mealTypes) || input.mealTypes.length > 200)
      throw new Error('外卖类型最多 200 个')
    const ids = new Set(),
      names = new Set()
    result.mealTypes = input.mealTypes.map((item) => {
      if (
        !item ||
        !text(item.id) ||
        !text(item.name?.trim(), 40) ||
        typeof item.enabled !== 'boolean' ||
        ids.has(item.id) ||
        names.has(item.name.trim().toLocaleLowerCase())
      )
        throw new Error('外卖类型格式不正确或重复')
      ids.add(item.id)
      names.add(item.name.trim().toLocaleLowerCase())
      return { id: item.id, name: item.name.trim(), enabled: item.enabled }
    })
  }
  if (input.mealHistory !== undefined) {
    if (!Array.isArray(input.mealHistory) || input.mealHistory.length > 500)
      throw new Error('菜单历史格式不正确')
    const ids = new Set()
    result.mealHistory = input.mealHistory.map((item) => {
      if (
        !item ||
        !text(item.id) ||
        ids.has(item.id) ||
        !calendarDate(item.date) ||
        !['早餐', '午餐', '晚餐'].includes(item.meal) ||
        !text(item.typeId) ||
        !text(item.typeName, 40) ||
        !text(item.createdAt, 64) ||
        !Number.isFinite(Date.parse(item.createdAt))
      )
        throw new Error('菜单选择记录格式不正确')
      ids.add(item.id)
      return {
        id: item.id,
        date: item.date,
        meal: item.meal,
        typeId: item.typeId,
        typeName: item.typeName,
        createdAt: item.createdAt,
      }
    })
  }
  if (new TextEncoder().encode(JSON.stringify(result)).length > 5_000_000)
    throw new Error('个人数据超过 5MB，请先归档部分历史记录')
  return result
}

// 兼容 v1 浏览器备份和 v2 可携带文件。
export function parsePersonalBackup(value) {
  if (![1, 2].includes(value?.version)) throw new Error('只支持 DailyDash v1 / v2 备份文件')
  return validatePersonalData(value.data)
}

export function hasPersonalContent(data) {
  return (
    ['sports', 'sleeps', 'favorites', 'mastered', 'readNews', 'mealHistory'].some(
      (key) => data[key]?.length,
    ) ||
    Object.keys(data.answers || {}).length > 0 ||
    JSON.stringify(data.mealTypes) !== JSON.stringify(defaultMealTypes)
  )
}

// 迁移以磁盘版本为准合并同 ID / 同睡眠日冲突；原始输入另存恢复文件。
export function mergePersonalData(current, incoming) {
  const result = { ...current }
  for (const key of ['sports', 'sleeps', 'mealHistory']) {
    const merged = new Map()
    for (const item of [...incoming[key], ...current[key]])
      merged.set(key === 'sleeps' ? item.date : item.id, item)
    result[key] = [...merged.values()]
  }
  for (const key of ['favorites', 'mastered', 'readNews'])
    result[key] = [...new Set([...current[key], ...incoming[key]])]
  result.answers = { ...incoming.answers, ...current.answers }
  const types = new Map()
  for (const item of [...incoming.mealTypes, ...current.mealTypes]) types.set(item.id, item)
  const names = new Set()
  result.mealTypes = [...current.mealTypes, ...types.values()].filter((item) => {
    const name = item.name.toLocaleLowerCase()
    if (names.has(name)) return false
    names.add(name)
    return true
  })
  return validatePersonalData(result)
}
