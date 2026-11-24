import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { root, paths } from '../crawler/src/utils/paths.js'
import { validateData } from '../shared/content-schema.js'

const modules = ['hotNews', 'songRank', 'englishWord', 'poetry', 'quiz', 'knowledge', 'food', 'digital']
const snapshots = new Map()
const media = new Set()

// 仅收集内容合同内的本站媒体，绝不扫描或上传个人记录目录。
function collectMedia(value) {
  if (typeof value === 'string' && /^\/media\/(?:audio|img)\/[\w.-]+$/.test(value)) media.add(value)
  else if (Array.isArray(value)) value.forEach(collectMedia)
  else if (value && typeof value === 'object') Object.values(value).forEach(collectMedia)
}

// 发布前校验全部八类内容；缺失或损坏时保留上次已提交的快照。
for (const name of modules) {
  const value = JSON.parse(await readFile(resolve(paths.output, name + '.json'), 'utf8'))
  validateData(name, value)
  snapshots.set(name, value)
  collectMedia(value)
}
snapshots.set('meta', JSON.parse(await readFile(resolve(paths.output, 'meta.json'), 'utf8')))
for (const path of media) await readFile(resolve(paths.public, path.slice(1)))

const target = resolve(root, 'site-content')
await mkdir(resolve(target, 'data'), { recursive: true })
await mkdir(resolve(target, 'media'), { recursive: true })
for (const [name, value] of snapshots)
  await writeFile(resolve(target, 'data', name + '.json'), JSON.stringify(value, null, 2) + '\n')
for (const path of media) {
  const destination = resolve(target, path.slice(1))
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(resolve(paths.public, path.slice(1)), destination)
}
console.log(`已更新 ${snapshots.size} 份公开内容文件、${media.size} 个引用媒体。提交后 Pages 自动重新发布。`)
