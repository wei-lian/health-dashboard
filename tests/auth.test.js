import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, getSession, signOut, loginDestination } from '../web-vue/src/utils/auth-session.js'

// 隔离浏览器存储，测试不写开发者的真实会话。
function memoryStorage() {
  const data = new Map()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
}

test('账号密码校验、刷新会话、过期和退出登录', async () => {
  const storage = memoryStorage()
  const now = Date.now()
  assert.equal(getSession(storage, now), null)
  for (const [username, password] of [
    ['admin', 'wrong'],
    ['other', '123456'],
    ['admin', '123456 '],
  ]) {
    await assert.rejects(signIn(username, password, storage, now), /账号或密码不正确/)
    assert.equal(getSession(storage, now), null)
  }
  await signIn('admin', '123456', storage, now)
  assert.equal(getSession(storage, now + 1000).username, 'admin')
  assert.ok(![...storage.data.values()].join('').includes('123456'))
  assert.equal(getSession(storage, now + 12 * 60 * 60 * 1000), null)
  await signIn('admin', '123456', storage, now)
  signOut(storage)
  assert.equal(getSession(storage, now), null)
})

test('损坏会话、存储禁用和外部重定向不会放行', async () => {
  const storage = memoryStorage()
  const key = 'dailydash.session.v1'
  storage.setItem(key, '{broken')
  assert.equal(getSession(storage), null)
  storage.setItem(key, JSON.stringify({ username: 'admin', expiresAt: 'forever' }))
  assert.equal(getSession(storage), null)
  const blocked = {
    getItem() {
      throw new Error('disabled')
    },
    setItem() {
      throw new Error('disabled')
    },
  }
  assert.equal(getSession(blocked), null)
  await assert.rejects(signIn('admin', '123456', blocked), /浏览器无法保存/)
  for (const path of [
    'https://example.com',
    '//example.com',
    '/\\example.com',
    '/login',
    '/login?redirect=/',
    null,
  ])
    assert.equal(loginDestination(path), '/')
  assert.equal(loginDestination('/records?period=week'), '/records?period=week')
})
