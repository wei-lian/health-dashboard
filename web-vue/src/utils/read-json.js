// 正式采集接入点：页面只读取静态 JSON，不直接抓取外站。
export async function readJson(module) {
  const allowed = [
    'hotNews',
    'quiz',
    'knowledge',
    'songRank',
    'food',
    'poetry',
    'englishWord',
    'digital',
    'meta',
  ]
  if (!allowed.includes(module)) throw new Error('未知数据模块')
  try {
    const response = await fetch(`/data/${module}.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json'))
      return { status: 'unavailable', data: null }
    return { status: 'ready', data: await response.json() }
  } catch {
    return { status: 'unavailable', data: null }
  }
}
