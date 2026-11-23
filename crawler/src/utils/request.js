import robotsParser from 'robots-parser'
import { createHash } from 'node:crypto'
import { mkdir, writeFile, rename, rm, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { paths } from './paths.js'

const agent = 'DailyDash/0.2 (personal local dashboard; once daily)'
const queues = new Map()
const robotsCache = new Map()
const apiHosts = new Set([
  'api.github.com',
  'raw.githubusercontent.com',
  'api.dictionaryapi.dev',
  'itunes.apple.com',
  'rss.applemarketingtools.com',
  'rss.marketingtools.apple.com',
])
export const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// 每个域名串行排队，两次请求至少间隔 2.2 秒。
async function limited(url, task) {
  const host = new URL(url).host
  const previous = queues.get(host) || Promise.resolve()
  const pending = previous.catch(() => {}).then(task)
  queues.set(
    host,
    pending.then(
      () => sleep(2200),
      () => sleep(2200),
    ),
  )
  return pending
}

// 有限时长、有限大小的 HTTP GET；不会绕过验证码或登录。
async function rawGet(url, { maxBytes = 2_000_000, redirects = 0, binary = false, skipRobots = false } = {}) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('只允许 HTTPS 数据源')
  if (!skipRobots && !apiHosts.has(parsed.hostname)) await checkRobots(url)
  const response = await limited(url, () =>
    fetch(url, {
      headers: { 'User-Agent': agent, Accept: binary ? '*/*' : 'application/json,text/html,text/plain,*/*' },
      signal: AbortSignal.timeout(20000),
      redirect: 'manual',
    }),
  )
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 4) throw new Error('数据源重定向过多')
    return rawGet(new URL(response.headers.get('location'), url).href, {
      maxBytes,
      redirects: redirects + 1,
      binary,
      skipRobots,
    })
  }
  if (!response.ok) {
    await response.body?.cancel()
    const error = new Error(`HTTP ${response.status}: ${parsed.hostname}`)
    error.status = response.status
    throw error
  }
  const chunks = []
  let size = 0
  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) {
        await reader.cancel()
        throw new Error('响应体超过大小限制')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return { bytes: Buffer.concat(chunks), headers: response.headers, url: response.url || url }
}

// robots 不可用时保守停止；明确 404 表示未提供规则。
async function checkRobots(url) {
  const origin = new URL(url).origin
  if (!robotsCache.has(origin))
    robotsCache.set(
      origin,
      (async () => {
        try {
          const { bytes } = await rawGet(`${origin}/robots.txt`, { skipRobots: true, maxBytes: 256000 })
          const text = bytes.toString('utf8')
          if (/<html|<script/i.test(text)) throw new Error('robots.txt 返回网页，暂不采集该站')
          return robotsParser(`${origin}/robots.txt`, text)
        } catch (error) {
          if (error.status === 404) return robotsParser(`${origin}/robots.txt`, '')
          throw error
        }
      })(),
    )
  const rules = await robotsCache.get(origin)
  if (rules.isAllowed(url, 'DailyDash') === false) throw new Error('robots.txt 禁止抓取该路径')
}

// 只对网络错误和 5xx 重试一次，429/403 不继续请求。
export async function request(url, options = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await rawGet(url, options)
      if (options.binary) return result
      const header = result.headers.get('content-type') || ''
      const initial = result.bytes.subarray(0, 500).toString('ascii')
      const encoding = /charset\s*=\s*["']?([\w-]+)/i.exec(header + initial)?.[1] || 'utf-8'
      return new TextDecoder(/gbk|gb2312/i.test(encoding) ? 'gb18030' : encoding).decode(result.bytes)
    } catch (error) {
      if (attempt || (error.status && error.status < 500) || /robots|限制|HTTPS/.test(error.message))
        throw error
      await sleep(2500)
    }
  }
}

// JSON 接口统一解析，异常响应不进入数据文件。
export async function requestJson(url) {
  return JSON.parse(await request(url))
}

// 仅本地保存词典发音及插图；Apple 试听按原地址在线播放，不下载。
export async function cacheAsset(url, kind = 'img') {
  const parsed = new URL(url)
  const allowed =
    kind === 'audio'
      ? ['api.dictionaryapi.dev']
      : ['www.cdstm.cn', 'www.themealdb.com', 'raw.githubusercontent.com']
  if (!allowed.includes(parsed.hostname)) return ''
  const ext = kind === 'audio' ? '.mp3' : /\.png(?:\?|$)/i.test(url) ? '.png' : '.jpg'
  const name = createHash('sha256').update(url).digest('hex').slice(0, 20) + ext
  const folder = resolve(paths.public, 'media', kind)
  const target = resolve(folder, name)
  await mkdir(folder, { recursive: true })
  try {
    await access(target)
    return `/media/${kind}/${name}`
  } catch {
    /* 首次下载。 */
  }
  const { bytes, headers } = await request(url, { binary: true, maxBytes: 5_000_000 })
  if (!(headers.get('content-type') || '').startsWith(kind === 'audio' ? 'audio/' : 'image/'))
    throw new Error('资源不是预期的音频或图片')
  const temporary = target + '.tmp'
  try {
    await writeFile(temporary, bytes)
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true })
  }
  return `/media/${kind}/${name}`
}
