import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createPersonalStorage } from '../server/personal-storage.js'
import { personalDataMiddleware } from '../server/personal-api.js'
import {
  emptyPersonalData,
  parsePersonalBackup,
  validatePersonalData,
  mergePersonalData,
} from '../shared/personal-schema.js'

const sport = (id = 'sport-1', duration = 30) => ({
  id,
  date: '2026-11-19',
  type: '步行',
  duration,
  intensity: '适中',
  note: '',
})
const fixture = () => ({
  ...emptyPersonalData(),
  sports: [sport()],
  sleeps: [
    { id: 'sleep-1', date: '2026-11-19', bed: '23:30', wake: '07:00', duration: 450, quality: 4, note: '' },
  ],
})
async function directory(t) {
  const folder = await mkdtemp(resolve(tmpdir(), 'dailydash-test-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  return folder
}
async function serve(t, storage) {
  const middleware = personalDataMiddleware(storage)
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404)
      res.end()
    }),
  )
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(
    () =>
      new Promise((done) => {
        server.close(done)
        server.closeAllConnections()
      }),
  )
  return `http://127.0.0.1:${server.address().port}`
}

test('v1 备份兼容，字段白名单和实际日历、时长、重复记录校验', () => {
  const old = fixture()
  delete old.mealTypes
  delete old.mealHistory
  old.sleeps[0].quality = '4'
  old.secret = '不应保存'
  const normalized = parsePersonalBackup({ version: 1, data: old })
  assert.equal(normalized.mealTypes.length, 6)
  assert.equal(normalized.sleeps[0].quality, 4)
  assert.equal(normalized.secret, undefined)
  for (const changes of [{ date: '2026-02-30' }, { duration: -1 }, { duration: Infinity }]) {
    const bad = fixture()
    Object.assign(bad.sports[0], changes)
    assert.throws(() => validatePersonalData(bad))
  }
  const duplicate = fixture()
  duplicate.sports.push(sport())
  assert.throws(() => validatePersonalData(duplicate))
  const duplicateNight = fixture()
  duplicateNight.sleeps.push({ ...duplicateNight.sleeps[0], id: 'another' })
  assert.throws(() => validatePersonalData(duplicateNight))
  const badClock = fixture()
  badClock.sleeps[0].wake = '25:00'
  assert.throws(() => validatePersonalData(badClock))
  const badType = fixture()
  badType.mealTypes.push({ id: 'other', name: badType.mealTypes[0].name, enabled: true })
  assert.throws(() => validatePersonalData(badType))
  const badHistory = fixture()
  badHistory.mealHistory = [
    { id: 'pick', date: '2026-11-19', meal: '午餐', typeId: 'rice', typeName: '简餐', createdAt: 123 },
  ]
  assert.throws(() => validatePersonalData(badHistory))
})

test('备份合并保留本机同 ID / 同睡眠日及外卖类型，补充新记录', () => {
  const current = fixture(),
    incoming = fixture()
  incoming.sports[0].duration = 99
  incoming.sports.push(sport('new', 20))
  incoming.sleeps[0].id = 'other'
  incoming.sleeps[0].duration = 300
  current.mealTypes.push({ id: 'local', name: '肠粉', enabled: false })
  incoming.mealTypes.push({ id: 'remote', name: '肠粉', enabled: true })
  const result = mergePersonalData(current, incoming)
  assert.equal(result.sports.find((item) => item.id === 'sport-1').duration, 30)
  assert.equal(result.sports.length, 2)
  assert.equal(result.sleeps.length, 1)
  assert.equal(result.sleeps[0].duration, 450)
  assert.deepEqual(
    result.mealTypes.find((item) => item.name === '肠粉'),
    { id: 'local', name: '肠粉', enabled: false },
  )
})

test('磁盘保存可跨实例重读，迁移原件和前版备份可恢复', async (t) => {
  const folder = await directory(t),
    storage = createPersonalStorage(folder)
  assert.equal((await storage.read()).exists, false)
  const first = await storage.migrate(fixture())
  assert.equal(first.revision, 1)
  assert.deepEqual(JSON.parse(await readFile(first.recovery, 'utf8')).data, fixture())
  const secondStorage = createPersonalStorage(folder)
  assert.deepEqual((await secondStorage.read()).data, fixture())
  const next = fixture()
  next.sports[0].duration = 45
  const second = await secondStorage.save(next, 1)
  assert.equal(second.storeId, first.storeId)
  const names = await readdir(resolve(folder, 'backups'))
  assert.deepEqual(JSON.parse(await readFile(resolve(folder, 'backups', names[0]), 'utf8')).data, fixture())
  assert.equal((await storage.read()).data.sports[0].duration, 45)
})

test('同时保存只有一个版本成功，旧版本和损坏数据不会覆盖新记录', async (t) => {
  const folder = await directory(t),
    one = createPersonalStorage(folder),
    two = createPersonalStorage(folder)
  await one.save(fixture(), 0)
  const a = fixture(),
    b = fixture()
  a.sports[0].duration = 40
  b.sports[0].duration = 50
  const results = await Promise.allSettled([one.save(a, 1), two.save(b, 1)])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  const conflict = results.find((r) => r.status === 'rejected').reason
  assert.equal(conflict.status, 409)
  assert.equal(conflict.current.revision, 2)
  const before = await readFile(one.file, 'utf8')
  await assert.rejects(one.save({ ...fixture(), sports: [{}] }, 2))
  assert.equal(await readFile(one.file, 'utf8'), before)
  for (const corrupt of [
    'null',
    '{broken',
    JSON.stringify({ version: 2, revision: 3, storeId: 'x', data: fixture() }),
  ]) {
    await writeFile(one.file, corrupt)
    await assert.rejects(one.read())
    await assert.rejects(one.save(fixture(), 0))
    assert.equal(await readFile(one.file, 'utf8'), corrupt)
  }
})

test('历史备份仅保留最近 30 份', async (t) => {
  const folder = await directory(t),
    storage = createPersonalStorage(folder)
  for (let revision = 0; revision < 33; revision++) await storage.save(fixture(), revision)
  const names = (await readdir(resolve(folder, 'backups'))).sort()
  assert.equal(names.length, 30)
  assert.match(names[0], /^0000000003-/)
  assert.match(names.at(-1), /^0000000032-/)
})

test('两个端口共用文件，API 拒绝跨站写入、非法 JSON 和版本冲突', async (t) => {
  const folder = await directory(t)
  const one = await serve(t, createPersonalStorage(folder)),
    two = await serve(t, createPersonalStorage(folder))
  const put = (origin, revision, data, actualOrigin = origin) =>
    fetch(origin + '/api/personal-data', {
      method: 'PUT',
      headers: { Origin: actualOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision, data }),
    })
  assert.equal((await fetch(one + '/api/personal-data')).status, 200)
  assert.equal((await put(one, 0, fixture(), 'https://untrusted.example')).status, 403)
  assert.equal(
    (
      await fetch(one + '/api/personal-data', {
        method: 'PUT',
        headers: { Origin: one, 'Content-Type': 'application/json' },
        body: '{broken',
      })
    ).status,
    400,
  )
  assert.equal((await put(one, 0, fixture())).status, 200)
  const other = await (await fetch(two + '/api/personal-data')).json()
  assert.equal(other.data.sports.length, 1)
  assert.equal(other.revision, 1)
  const conflict = await put(two, 0, emptyPersonalData())
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).current.data.sports.length, 1)
  assert.equal((await fetch(two + '/api/personal-data', { headers: { Origin: one } })).status, 403)
  const invalid = fixture()
  invalid.mealHistory = [{}]
  assert.equal((await put(two, 1, invalid)).status, 422)
  const merged = await fetch(two + '/api/personal-data/migrate', {
    method: 'POST',
    headers: { Origin: two, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ...fixture(), sports: [sport('new')] } }),
  })
  assert.equal(merged.status, 200)
  assert.equal((await merged.json()).data.sports.length, 2)
})

test('CLI 下载导出和另一台电脑目录导入往返保留健康、学习和自定义菜单', async (t) => {
  const one = await directory(t),
    two = await directory(t),
    output = resolve(one, 'portable.json')
  const data = fixture()
  data.mealTypes[0].enabled = false
  data.mealTypes.push({ id: 'custom', name: '肠粉', enabled: true })
  data.mealHistory.push({
    id: 'pick',
    date: '2026-11-19',
    meal: '午餐',
    typeId: 'custom',
    typeName: '肠粉',
    createdAt: '2026-11-19T04:00:00Z',
  })
  data.favorites = ['poem']
  data.answers = { quiz: 2 }
  await createPersonalStorage(one).save(data, 0)
  const run = promisify(execFile),
    script = resolve('scripts/personal-data.js')
  await run(process.execPath, [script, 'export', output], {
    env: { ...process.env, DAILYDASH_DATA_DIR: one },
  })
  await run(process.execPath, [script, 'import', output], {
    env: { ...process.env, DAILYDASH_DATA_DIR: two },
  })
  assert.deepEqual((await createPersonalStorage(two).read()).data, data)
})
