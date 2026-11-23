import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, readdir, rm } from 'node:fs/promises'
import { atomicJson, readJson } from '../crawler/src/utils/storage.js'
import { emptyPersonalData, validatePersonalData, mergePersonalData } from '../shared/personal-schema.js'

export const personalFolder = process.env.DAILYDASH_DATA_DIR || resolve(homedir(), '.dailydash')

// 数据目录可独立于项目迁移；测试通过临时目录运行。
export function createPersonalStorage(folder = personalFolder) {
  const file = resolve(folder, 'personal-data.json'),
    lockPath = resolve(folder, 'personal-data.lock')
  async function read() {
    const missing = Symbol('missing')
    const value = await readJson(file, missing)
    if (value === missing)
      return {
        version: 2,
        revision: 0,
        storeId: '',
        updatedAt: null,
        exists: false,
        data: emptyPersonalData(),
      }
    if (
      !value ||
      value.version !== 2 ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 1 ||
      typeof value.storeId !== 'string' ||
      !value.storeId ||
      !Number.isFinite(Date.parse(value.updatedAt))
    )
      throw new Error('本机数据文件损坏，请从历史备份恢复；不会覆盖现有文件')
    return { ...value, exists: true, data: validatePersonalData(value.data) }
  }
  // 文件锁覆盖不同端口、脚本与多个 Node 进程，防止同时写入覆盖。
  async function lock() {
    await mkdir(folder, { recursive: true })
    const deadline = Date.now() + 5000
    while (true) {
      try {
        const handle = await open(lockPath, 'wx')
        await handle.writeFile(String(process.pid))
        await handle.close()
        return () => rm(lockPath, { force: true })
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
        const pid = Number(await readFile(lockPath, 'utf8').catch(() => ''))
        if (pid > 0 && Number.isSafeInteger(pid)) {
          try {
            process.kill(pid, 0)
          } catch (reason) {
            if (reason.code === 'ESRCH') {
              await rm(lockPath, { force: true })
              continue
            }
          }
        }
        if (Date.now() >= deadline) throw new Error('数据文件正在写入，请稍后重试')
        await new Promise((done) => setTimeout(done, 50))
      }
    }
  }
  async function write(current, data) {
    if (current.exists) {
      const backups = resolve(folder, 'backups')
      await atomicJson(
        resolve(backups, `${String(current.revision).padStart(10, '0')}-${randomUUID()}.json`),
        { version: 2, exportedAt: new Date().toISOString(), data: current.data },
      )
      const files = (await readdir(backups)).filter((name) => /^\d{10}-[a-f0-9-]+\.json$/.test(name)).sort()
      for (const name of files.slice(0, Math.max(0, files.length - 30))) await rm(resolve(backups, name))
    }
    const value = {
      version: 2,
      revision: current.revision + 1,
      storeId: current.storeId || randomUUID(),
      updatedAt: new Date().toISOString(),
      data,
    }
    await atomicJson(file, value)
    return { ...value, exists: true }
  }
  async function save(data, expectedRevision) {
    const valid = validatePersonalData(data),
      release = await lock()
    try {
      const current = await read()
      if (expectedRevision !== current.revision) {
        const error = new Error('其他窗口已修改记录，请刷新后重试')
        error.status = 409
        error.current = current
        throw error
      }
      return await write(current, valid)
    } finally {
      await release()
    }
  }
  async function migrate(data) {
    const incoming = validatePersonalData(data),
      release = await lock()
    try {
      const current = await read()
      const recovery = resolve(folder, 'recoveries', `browser-${randomUUID()}.json`)
      await atomicJson(recovery, { version: 2, exportedAt: new Date().toISOString(), data: incoming })
      const merged = current.exists ? mergePersonalData(current.data, incoming) : incoming
      return { ...(await write(current, merged)), recovery }
    } finally {
      await release()
    }
  }
  return { file, folder, read, save, migrate }
}
