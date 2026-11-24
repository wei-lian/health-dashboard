const sessionKey = 'dailydash.session.v1'
const sessionDuration = 12 * 60 * 60 * 1000
const passwordHash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'

// 静态站点的页面登录门槛；不能替代服务端鉴权或保护公开文件。
export async function signIn(username, password, storage = globalThis.sessionStorage, now = Date.now()) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
  if (username.trim() !== 'admin' || hash !== passwordHash) throw new Error('账号或密码不正确，请重新输入。')
  const session = { username: 'admin', expiresAt: now + sessionDuration }
  try {
    storage.setItem(sessionKey, JSON.stringify(session))
  } catch {
    throw new Error('浏览器无法保存登录状态，请允许此网站使用浏览器存储后重试。')
  }
  return session
}

// 每次访问都校验有效期，损坏或过期的会话按未登录处理。
export function getSession(storage = globalThis.sessionStorage, now = Date.now()) {
  try {
    const session = JSON.parse(storage.getItem(sessionKey) || 'null')
    if (
      session?.username === 'admin' &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > now &&
      session.expiresAt <= now + sessionDuration
    )
      return session
    storage.removeItem(sessionKey)
  } catch {
    /* 存储不可用或被修改时不放行受保护页面。 */
  }
  return null
}

// 退出只清除当前会话，不删除用户已保存的个人记录。
export function signOut(storage = globalThis.sessionStorage) {
  storage.removeItem(sessionKey)
}

// 登录后只返回站内页面，拒绝外链和登录页自身。
export function loginDestination(value) {
  return typeof value === 'string' && /^\/(?![\\/])/.test(value) && !/^\/login(?:[/?#]|$)/i.test(value)
    ? value
    : '/'
}
