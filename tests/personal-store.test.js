import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyPersonalData } from '../shared/personal-schema.js'

const envelope = (data, revision = 1) => ({
  version: 2,
  data,
  revision,
  exists: true,
  storeId: 'local',
  file: 'test/personal-data.json',
  updatedAt: '2026-11-19T08:00:00Z',
})
const response = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

test('前端迁移、磁盘确认、重复保存保护、断开和冲突后均可重试', async () => {
  const originalFetch = globalThis.fetch,
    originalStorage = globalThis.localStorage
  const old = emptyPersonalData()
  old.sports = [{ id: 'old', date: '2026-11-19', duration: 30, type: '步行', intensity: '适中', note: '' }]
  const memory = new Map([['dailydash.local.v1', JSON.stringify(old)]])
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value),
  }
  let calls = 0,
    finish,
    mode = 'init'
  globalThis.fetch = async (url, options) => {
    calls++
    if (mode === 'init')
      return response(
        url.endsWith('/migrate')
          ? envelope(old)
          : { ...envelope(emptyPersonalData(), 0), exists: false, storeId: '' },
      )
    assert.equal(options.method, 'PUT')
    return new Promise((done) => {
      finish = done
    })
  }
  try {
    const store = await import('../web-vue/src/stores/local-store.js?personal-store-test')
    await store.initializePersonalData()
    assert.equal(calls, 2)
    assert.equal(store.state.sports.length, 1)
    assert.ok(memory.has('dailydash.migrated.v1'))
    mode = 'save'
    const changes = { favorites: ['poem'] }
    const first = store.persist(changes)
    assert.equal(store.sync.saving, true)
    assert.deepEqual([...store.state.favorites], [])
    assert.equal(await store.persist(changes), false)
    assert.equal(calls, 3)
    finish(response(envelope({ ...old, ...changes }, 2)))
    assert.equal(await first, true)
    assert.deepEqual([...store.state.favorites], ['poem'])
    assert.equal(store.sync.saving, false)
    const failure = store.persist({ favorites: ['unsaved'] })
    finish(response({ error: '模拟磁盘不可写' }, 422))
    assert.equal(await failure, false)
    assert.deepEqual([...store.state.favorites], ['poem'])
    assert.equal(store.sync.saving, false)
    assert.match(store.sync.error, /磁盘不可写/)
    const conflict = store.persist({ favorites: ['stale'] })
    finish(response({ error: '版本冲突', current: envelope({ ...old, favorites: ['newer'] }, 3) }, 409))
    assert.equal(await conflict, false)
    assert.deepEqual([...store.state.favorites], ['newer'])
    assert.equal(store.sync.revision, 3)
    assert.equal(store.sync.saving, false)
    globalThis.fetch = async () => {
      throw new Error('模拟连接中断')
    }
    assert.equal(await store.refreshPersonalData(), false)
    assert.equal(store.sync.online, false)
    assert.equal(await store.persist({ favorites: [] }), false)
    assert.deepEqual([...store.state.favorites], ['newer'])
    globalThis.fetch = async () => response(envelope({ ...old, favorites: ['newer'] }, 3))
    assert.equal(await store.initializePersonalData(), true)
    assert.equal(store.sync.online, true)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})

test('轮询请求复用，迟到的读取结果不能覆盖正在保存的数据', async () => {
  const originalFetch = globalThis.fetch,
    originalStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => null, setItem: () => {} }
  globalThis.fetch = async () => response(envelope(emptyPersonalData()))
  try {
    const store = await import('../web-vue/src/stores/local-store.js?personal-refresh-test')
    await store.initializePersonalData()
    let finishRead,
      finishSave,
      reads = 0
    globalThis.fetch = (url, options) =>
      new Promise((done) => {
        if (options.method === 'PUT') finishSave = done
        else {
          reads++
          finishRead = done
        }
      })
    const one = store.refreshPersonalData(),
      two = store.refreshPersonalData()
    assert.equal(reads, 1)
    const saving = store.persist({ mastered: ['word'] })
    finishRead(response(envelope(emptyPersonalData(), 2)))
    assert.equal(await one, true)
    assert.equal(await two, true)
    assert.equal(store.sync.revision, 1)
    finishSave(response(envelope({ ...emptyPersonalData(), mastered: ['word'] }, 2)))
    assert.equal(await saving, true)
    assert.deepEqual([...store.state.mastered], ['word'])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
