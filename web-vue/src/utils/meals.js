// 随机候选只来自启用类型，有多个候选时避免紧接着重复上次类型。
export function chooseMeal(types, lastId = '', random = Math.random) {
  const available = types.filter((item) => item.enabled)
  if (!available.length) throw new Error('先启用或新增一个外卖类型，再来随机选择吧。')
  const pool = available.length > 1 ? available.filter((item) => item.id !== lastId) : available
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))]
}
