import { mkdir, open, readFile, rm, appendFile, readdir, access, cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { paths, chinaDate, root } from './utils/paths.js'
import { readJson, atomicJson } from './utils/storage.js'
import { validateData } from './utils/schema.js'
import { modules } from './modules.js'

// 启动前检查进程锁，避免任务计划与手动运行重叠。
export async function acquireLock(folder) {
  await mkdir(folder, { recursive: true })
  const path = resolve(folder, 'run.lock')
  try {
    const handle = await open(path, 'wx')
    await handle.writeFile(String(process.pid))
    await handle.close()
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const pid = Number(await readFile(path, 'utf8'))
    if (!Number.isSafeInteger(pid) || pid <= 0)
      throw new Error('锁文件异常，请确认无采集进程后移除 crawler/state/run.lock')
    let active = true
    try {
      process.kill(pid, 0)
    } catch (reason) {
      if (reason.code === 'ESRCH') active = false
      else throw reason
    }
    if (active) throw new Error(`采集正在运行（PID ${pid}），本次不重复启动`)
    await rm(path)
    return acquireLock(folder)
  }
  return () => rm(path, { force: true })
}

// 从唯一输出同步到 Vite 静态目录；开发与生产构建消费同一份文件。
export async function publishData() {
  const folders = [resolve(paths.public, 'data')]
  try {
    await access(resolve(root, 'dist/index.html'))
    folders.push(resolve(root, 'dist/data'))
  } catch {
    /* 尚未构建。 */
  }
  for (const folder of folders) {
    await mkdir(folder, { recursive: true })
    for (const name of await readdir(paths.output)) {
      if (name.endsWith('.json')) {
        try {
          await atomicJson(resolve(folder, name), await readJson(resolve(paths.output, name)))
        } catch (error) {
          if (error instanceof SyntaxError) console.error(`[不同步损坏文件] ${name}`)
          else throw error
        }
      }
    }
  }
  if (folders.length > 1) {
    try {
      await cp(resolve(paths.public, 'media'), resolve(root, 'dist/media'), { recursive: true })
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

// 串行采集、验证、独立落盘并记录每个模块的成功时间和失败原因。
export async function run(options = {}) {
  if (options.publishOnly) return publishData()
  const today = chinaDate()
  const targetDate = options.targetDate || chinaDate(new Date(Date.now() - 86400000))
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(targetDate) ||
    !Number.isFinite(Date.parse(targetDate)) ||
    new Date(targetDate).toISOString().slice(0, 10) !== targetDate ||
    targetDate >= today
  )
    throw new Error('--date 必须是今天之前的 YYYY-MM-DD 日期')
  if (options.module && !modules.some((item) => item.name === options.module)) throw new Error('未知模块名称')
  const release = await acquireLock(paths.state)
  try {
    await mkdir(paths.output, { recursive: true })
    await mkdir(paths.logs, { recursive: true })
    const previous = await readJson(resolve(paths.output, 'meta.json'), { modules: [] }).catch(() => ({
      modules: [],
    }))
    const statuses = new Map(previous.modules.map((item) => [item.name, item]))
    let failed = 0
    const started = Date.now()
    for (const module of modules.filter((item) => !options.module || item.name === options.module)) {
      const old = statuses.get(module.name)
      const file = resolve(paths.output, `${module.name}.json`)
      const existing = await readJson(file)
        .then((data) => validateData(module.name, data))
        .catch(() => null)
      if (
        !options.force &&
        existing &&
        old?.lastRunDate === today &&
        old?.targetDate === targetDate &&
        old?.ok
      ) {
        console.log(`[跳过] ${module.name} 今天已生成，强制重跑请加 --force`)
        continue
      }
      const begin = Date.now(),
        updatedAt = new Date().toISOString()
      try {
        const data = validateData(
          module.name,
          await module.collect({
            targetDate,
            today,
            updatedAt,
            previous: await readJson(file).catch(() => null),
          }),
        )
        await atomicJson(file, data)
        const count =
          data.items?.length ||
          data.words?.length ||
          data.poems?.length ||
          data.currentTop100?.length ||
          (data.phones?.length || 0) + (data.laptops?.length || 0) ||
          1
        statuses.set(module.name, {
          name: module.name,
          ok: true,
          mode: data.mode || 'live',
          count,
          date: data.date,
          targetDate,
          lastRunDate: today,
          lastSuccessAt: updatedAt,
          attemptedAt: updatedAt,
          ms: Date.now() - begin,
          warning: data.warning || '',
        })
        console.log(`[成功] ${module.name} · ${count} 条 · ${data.mode || 'live'}`)
      } catch (error) {
        failed++
        statuses.set(module.name, {
          ...old,
          name: module.name,
          ok: false,
          targetDate,
          lastRunDate: today,
          attemptedAt: updatedAt,
          ms: Date.now() - begin,
          error: error.message,
          retained: await readJson(file)
            .then(Boolean)
            .catch(() => false),
        })
        console.error(`[失败] ${module.name}: ${error.message}（保留上次文件）`)
      }
      await appendFile(resolve(paths.logs, `${today}.log`), JSON.stringify(statuses.get(module.name)) + '\n')
    }
    const meta = {
      runAt: new Date().toISOString(),
      targetDate,
      timeZone: 'Asia/Shanghai',
      mode: 'production',
      modules: modules.map(
        (item) => statuses.get(item.name) || { name: item.name, ok: false, error: '尚未运行' },
      ),
      totalMs: Date.now() - started,
    }
    await atomicJson(resolve(paths.output, 'meta.json'), meta)
    await publishData()
    console.log(`输出：${paths.output}\n日志：${paths.logs}\n本次失败模块：${failed}`)
    return { failed, meta }
  } finally {
    await release()
  }
}
