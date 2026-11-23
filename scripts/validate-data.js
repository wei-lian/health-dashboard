import { readJson } from '../crawler/src/utils/storage.js'
import { paths } from '../crawler/src/utils/paths.js'
import { validateData } from '../crawler/src/utils/schema.js'
import { modules } from '../crawler/src/modules.js'
import { resolve } from 'node:path'

// 对真实输出执行与写入前相同的数据契约检查。
for (const module of modules) {
  validateData(module.name, await readJson(resolve(paths.output, `${module.name}.json`)))
  console.log(`PASS ${module.name}`)
}
