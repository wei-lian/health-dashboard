import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserPersonalStorage } from '../web-vue/src/utils/browser-personal-data.js'
import { publicAssetUrl } from '../web-vue/src/utils/deployment.js'
import { emptyPersonalData } from '../shared/personal-schema.js'

// 模拟同一网站的多个标签页，校验不会影响磁盘存储的静态适配器。
function memoryStorage() {
  const data = new Map()
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}

test('Pages 个人记录在刷新后保留，旧版本不能覆盖新记录', () => {
  const storage = memoryStorage()
  const one = createBrowserPersonalStorage(storage)
  assert.equal(one.read().exists, false)
  const data = emptyPersonalData()
  data.favorites = ['poem']
  const saved = one.save(data, 0)
  const two = createBrowserPersonalStorage(storage)
  assert.deepEqual(two.read().data, data)
  assert.equal(two.read().storeId, saved.storeId)
  assert.throws(
    () => two.save(emptyPersonalData(), 0),
    (error) => {
      assert.equal(error.current.revision, 1)
      return true
    },
  )
  assert.deepEqual(one.read().data.favorites, ['poem'])
  assert.throws(() => two.save({ ...data, sports: [{}] }, 1))
  assert.deepEqual(one.read().data, data)
})

test('Pages 存储失败和损坏数据不会被当成保存成功', () => {
  const storage = memoryStorage()
  const adapter = createBrowserPersonalStorage(storage)
  adapter.save(emptyPersonalData(), 0)
  const before = [...storage.data.values()][0]
  storage.setItem = () => {
    throw new Error('QuotaExceededError')
  }
  assert.throws(() => adapter.save(emptyPersonalData(), 1), /浏览器保存失败/)
  assert.equal([...storage.data.values()][0], before)
  storage.data.set('dailydash.pages.personal.v1', '{broken')
  assert.throws(() => adapter.read(), /浏览器记录损坏/)
  assert.throws(() => adapter.save(emptyPersonalData(), 0), /浏览器记录损坏/)
  assert.equal([...storage.data.values()][0], '{broken')
})

test('Pages 合并旧记录并保留本地优先项', () => {
  const adapter = createBrowserPersonalStorage(memoryStorage())
  const data = emptyPersonalData()
  data.favorites = ['existing']
  adapter.save(data, 0)
  const merged = adapter.migrate({ ...emptyPersonalData(), favorites: ['imported'] })
  assert.deepEqual(merged.data.favorites, ['existing', 'imported'])
  assert.equal(merged.revision, 2)
})

test('仓库子路径用于 JSON、图片和语音，外部音频保持原 URL', () => {
  assert.equal(
    publicAssetUrl('/data/poetry.json', '/health-dashboard/'),
    '/health-dashboard/data/poetry.json',
  )
  assert.equal(
    publicAssetUrl('/media/audio/voice.wav', '/health-dashboard/'),
    '/health-dashboard/media/audio/voice.wav',
  )
  assert.equal(
    publicAssetUrl('https://example.com/preview.m4a', '/health-dashboard/'),
    'https://example.com/preview.m4a',
  )
  assert.equal(publicAssetUrl(undefined, '/health-dashboard/'), undefined)
})
