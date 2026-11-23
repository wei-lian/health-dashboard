import { requestJson } from './utils/request.js'
import { chinaDate, paths } from './utils/paths.js'
import { resolve } from 'node:path'
import { readJson, atomicJson } from './utils/storage.js'

// 按逐日榜单快照计算本地累计积分；同一天重跑替换快照，不重复计分。
export function aggregateSnapshots(snapshots, prefix, limit) {
  const scores = new Map()
  for (const [date, songs] of Object.entries(snapshots).filter(([date]) => date.startsWith(prefix))) {
    for (const [index, song] of songs.entries()) {
      const previous = scores.get(song.id) || { ...song, heat: 0, days: 0, latestDate: '' }
      scores.set(song.id, {
        ...previous,
        ...song,
        heat: previous.heat + Math.max(1, 100 - index),
        days: previous.days + 1,
        latestDate: date,
      })
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.heat - a.heat || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

// 歌曲 ID 相同才关联平台试听，不按模糊歌名匹配，避免播错版本。
async function enrichPreview(songs, previous) {
  const old = new Map((previous?.currentTop100 || []).map((song) => [song.id, song]))
  for (const song of songs) {
    const prior = old.get(song.id)
    if (prior?.previewUrl) song.previewUrl = prior.previewUrl
  }
  for (const country of ['hk', 'us']) {
    const missing = songs.slice(0, 20).filter((song) => !song.previewUrl)
    if (!missing.length) break
    try {
      const response = await requestJson(
        `https://itunes.apple.com/lookup?id=${missing.map((song) => song.id).join(',')}&country=${country}&entity=song`,
      )
      for (const item of response.results || []) {
        const song = songs.find((entry) => entry.id === String(item.trackId))
        if (song && item.previewUrl?.startsWith('https://audio-ssl.itunes.apple.com/'))
          song.previewUrl = item.previewUrl
      }
    } catch {
      /* 不可试听的歌曲保留平台完整收听入口。 */
    }
  }
  return songs
}

export async function collect({ today, targetDate, updatedAt, previous }) {
  const sourceUrl = 'https://rss.applemarketingtools.com/api/v2/cn/music/most-played/100/songs.json'
  const feed = (await requestJson(sourceUrl)).feed
  if (!feed?.results?.length) throw new Error('Apple 榜单为空')
  const currentTop100 = await enrichPreview(
    feed.results.map((item, index) => ({
      id: String(item.id),
      rank: index + 1,
      song: item.name,
      artist: item.artistName,
      url: item.url,
      cover: item.artworkUrl100 || '',
      trend: '—',
      previewUrl: '',
    })),
    previous,
  )
  const historyFile = resolve(paths.state, 'song-history.json')
  const snapshots = { ...(await readJson(historyFile, {})), [today]: currentTop100 }
  // 输出保留近 400 天元数据供月年聚合，不保存或下载音源。
  const cutoff = chinaDate(new Date(Date.now() - 400 * 86400000))
  for (const date of Object.keys(snapshots)) if (date < cutoff) delete snapshots[date]
  await atomicJson(historyFile, snapshots)
  const dailyDate = snapshots[targetDate] ? targetDate : today
  const months = [...new Set(Object.keys(snapshots).map((date) => date.slice(0, 7)))].sort()
  return {
    date: dailyDate,
    targetDate,
    observedDate: today,
    updatedAt,
    source: 'Apple Music 中国区公开热门歌曲榜 / iTunes 公开试听',
    sourceUrl,
    sourceUpdatedAt: feed.updated,
    mode: 'live',
    notice:
      '日榜按实际快照日期展示；首次运行没有昨日快照，显示今日快照。月年榜是本机自启用日起累计：单日第 1 名 100 分，依次递减。试听为平台公开片段，非整曲，可能因地域或下架不可用。',
    currentTop100,
    dailyTop10: snapshots[dailyDate].slice(0, 10),
    yearlyTop100: aggregateSnapshots(snapshots, today.slice(0, 4), 100),
    monthly: Object.fromEntries(months.map((month) => [month, aggregateSnapshots(snapshots, month, 20)])),
    startedAt: previous?.startedAt || today,
  }
}
