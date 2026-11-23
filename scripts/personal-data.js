import { resolve } from 'node:path'
import { createPersonalStorage } from '../server/personal-storage.js'
import { atomicJson, readJson } from '../crawler/src/utils/storage.js'
import { parsePersonalBackup, mergePersonalData } from '../shared/personal-schema.js'

// 与网页共用锁、校验、版本和备份，命令行也不会绕过冲突保护。
const [action, ...args] = process.argv.slice(2)
const storage = createPersonalStorage()
try {
  if (action === 'path') console.log(storage.file)
  else if (action === 'export') {
    const current = await storage.read()
    if (!current.exists) throw new Error('尚无电脑数据，请先打开网页保存或迁移记录')
    const output = resolve(
      args.find((value) => !value.startsWith('--')) ||
        `DailyDash-备份-${new Date().toISOString().slice(0, 10)}.json`,
    )
    await atomicJson(output, { version: 2, exportedAt: new Date().toISOString(), data: current.data })
    console.log(`已导出：${output}`)
  } else if (action === 'import') {
    const input = args.find((value) => !value.startsWith('--'))
    if (!input) throw new Error('请指定备份 JSON 路径')
    const incoming = parsePersonalBackup(await readJson(resolve(input)))
    const current = await storage.read()
    await storage.save(
      args.includes('--replace') || !current.exists ? incoming : mergePersonalData(current.data, incoming),
      current.revision,
    )
    console.log(`已${args.includes('--replace') ? '替换' : '合并'}保存：${storage.file}；原版本位于 backups`)
  } else
    throw new Error(
      '用法：node scripts/personal-data.js path | export [输出文件] | import 备份文件 [--replace]',
    )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
