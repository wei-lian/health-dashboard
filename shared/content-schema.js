// 检查必须字段和非空集合，防止选择器失效后用空文件覆盖好数据。
export function validateData(name, data) {
  if (
    !data ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !Number.isFinite(Date.parse(data.updatedAt)) ||
    !data.source
  )
    throw new Error(`${name}: 缺少日期、来源或更新时间`)
  const requireList = (items, fields) => {
    if (!Array.isArray(items) || !items.length) throw new Error(`${name}: 没有有效条目，保留旧数据`)
    if (
      !items.every(
        (item) =>
          item && fields.every((key) => item[key] !== undefined && item[key] !== null && item[key] !== ''),
      )
    )
      throw new Error(`${name}: 条目字段不完整`)
  }
  if (name === 'hotNews') requireList(data.items, ['id', 'title', 'url', 'category'])
  if (name === 'quiz') {
    requireList(data.items, ['id', 'question', 'answer', 'explain'])
    if (!data.items.every((item) => item.options?.length >= 2 && /^[ABCD]$/.test(item.answer)))
      throw new Error('答题结构不合法')
  }
  if (name === 'knowledge') requireList(data.items, ['id', 'title', 'body', 'ref'])
  if (name === 'englishWord') requireList(data.words, ['w', 'cn', 'eg'])
  if (name === 'poetry') {
    if (!data.poem?.content?.length || !data.poem.author || !data.poem.title)
      throw new Error('诗词正文、作者或标题缺失')
  }
  if (name === 'food') {
    if (!data.today?.name || !data.today?.steps?.length || !data.today?.ingredients?.length)
      throw new Error('食材或做法解析失败')
  }
  if (name === 'songRank') {
    const fields = ['id', 'song', 'artist', 'url']
    requireList(data.currentTop100, fields)
    requireList(data.dailyTop10, fields)
    requireList(data.yearlyTop100, fields)
    if (!data.monthly || typeof data.monthly !== 'object' || Array.isArray(data.monthly))
      throw new Error('月榜结构不合法')
    for (const list of Object.values(data.monthly)) requireList(list, fields)
  }
  if (name === 'digital') {
    requireList(data.phones, ['model', 'priceRange', 'url'])
    requireList(data.laptops, ['model', 'priceRange', 'url'])
  }
  if (new TextEncoder().encode(JSON.stringify(data)).length > 500_000)
    throw new Error(`${name}: JSON 超过 500KB`)
  return data
}
