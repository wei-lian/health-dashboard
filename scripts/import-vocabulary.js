import { mkdir, writeFile, rename, readFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const sources = [
  '1521164643060_CET4_3.zip',
  '1521164633851_CET6_3.zip',
  '1521164658897_KaoYan_3.zip',
  '1521164666922_IELTS_3.zip',
  '1521164667985_TOEFL_3.zip',
]
const base = 'https://raw.githubusercontent.com/kajweb/dict/master/book/'

// 解压上游 ZIP 中的 JSON，保留词典原始信息，禁止用模板凑例句。
function unzip(buffer) {
  for (let offset = 0; offset < buffer.length - 46; offset++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue
    const size = buffer.readUInt32LE(offset + 20)
    const nameSize = buffer.readUInt16LE(offset + 28)
    const name = buffer.subarray(offset + 46, offset + 46 + nameSize).toString()
    if (!name.endsWith('.json')) continue
    const local = buffer.readUInt32LE(offset + 42)
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const bytes = buffer.subarray(start, start + size)
    return (buffer.readUInt16LE(offset + 10) === 8 ? inflateRawSync(bytes) : bytes).toString('utf8')
  }
  throw new Error('词库压缩包没有 JSON 文件')
}

const entries = new Map()
const cache = new URL('../crawler/tmp/vocabulary/', import.meta.url)
await mkdir(cache, { recursive: true })
for (const file of sources) {
  const url = base + file
  let bytes
  try {
    bytes = await readFile(new URL(file, cache))
  } catch {
    console.log(`下载 ${file}（已缓存的词书不重复下载）`)
    for (const host of [`https://cdn.jsdelivr.net/gh/kajweb/dict@master/book/${file}`, url]) {
      try {
        const part = new URL(file + '.part', cache)
        execFileSync(
          process.platform === 'win32' ? 'curl.exe' : 'curl',
          [
            '--fail',
            '--location',
            '--silent',
            '--show-error',
            '--connect-timeout',
            '10',
            '--max-time',
            '180',
            '--continue-at',
            '-',
            '--output',
            fileURLToPath(part),
            host,
          ],
          { maxBuffer: 40_000_000 },
        )
        bytes = await readFile(part)
        unzip(bytes)
        await writeFile(new URL(file, cache), bytes)
        break
      } catch {
        bytes = null
      }
    }
    if (!bytes) throw new Error(`无法下载 ${file}，已有词库保持不变，请稍后重试`)
  }
  const records = unzip(bytes)
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line))
  for (const record of records) {
    const w = record.headWord?.trim().toLowerCase()
    const raw = record.content?.word?.content
    const sentences = raw?.sentence?.sentences?.filter((s) => s.sContent?.trim() && s.sCn?.trim()) || []
    if (
      !/^[a-z]+(?:[-'][a-z]+)*$/.test(w || '') ||
      !raw?.trans?.length ||
      !sentences.length ||
      !(raw.usphone || raw.ukphone)
    )
      continue
    if (entries.has(w)) continue
    entries.set(w, {
      id: w,
      w,
      phonetic: raw.usphone || raw.ukphone,
      ukphone: raw.ukphone || '',
      usphone: raw.usphone || '',
      pos: [...new Set(raw.trans.map((t) => t.pos).filter(Boolean))].join(' / '),
      cn: raw.trans.map((t) => `${t.pos ? t.pos + '. ' : ''}${t.tranCn}`).join('；'),
      eg: sentences[0].sContent,
      egCn: sentences[0].sCn,
      sentences: sentences.map((s) => ({ en: s.sContent, cn: s.sCn })),
      book: record.bookId,
      source: url,
      detail: raw,
    })
  }
  console.log(`${file}: ${records.length} 条，上游真实例句去重后累计 ${entries.size} 个单词`)
}
if (entries.size < 5000) throw new Error(`仅 ${entries.size} 个有效单词，未覆盖原文件`)
const directory = new URL('../web-vue/public/library/', import.meta.url)
await mkdir(directory, { recursive: true })
const target = new URL('vocabulary.json', directory)
const temporary = new URL('vocabulary.json.tmp', directory)
await writeFile(
  temporary,
  JSON.stringify({
    version: 1,
    source: 'kajweb/dict · 有道词书公开归档',
    sourceUrl: 'https://github.com/kajweb/dict',
    importedAt: new Date().toISOString(),
    count: entries.size,
    words: [...entries.values()],
  }) + '\n',
)
await rename(temporary, target)
console.log(`词库已写入 ${target.pathname}`)
