import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

// 缺失文件返回兜底；损坏文件不能静默当作正常数据。
export async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

// 同目录临时文件校验后原子替换，失败时保留旧版本。
export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8')
    JSON.parse(await readFile(temporary, 'utf8'))
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}
