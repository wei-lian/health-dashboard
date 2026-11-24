import {
  emptyPersonalData,
  mergePersonalData,
  validatePersonalData,
} from '../../../shared/personal-schema.js'

const storageKey = 'dailydash.pages.personal.v1'

// Pages 没有 Node 服务，个人记录仅保存在当前浏览器，沿用同一份校验与版本合同。
export function createBrowserPersonalStorage(storage = globalThis.localStorage) {
  const read = () => {
    const raw = storage.getItem(storageKey)
    if (!raw)
      return {
        exists: false,
        revision: 0,
        storeId: '',
        updatedAt: '',
        data: emptyPersonalData(),
        file: '当前浏览器 · 此网站的本地存储',
      }
    let value
    try {
      value = JSON.parse(raw)
      if (
        value.version !== 1 ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < 1 ||
        typeof value.storeId !== 'string' ||
        !value.storeId ||
        !Number.isFinite(Date.parse(value.updatedAt))
      )
        throw new Error('记录格式错误')
      value.data = validatePersonalData(value.data)
    } catch {
      throw new Error('浏览器记录损坏，原记录未覆盖，请从 JSON 备份恢复或联系维护者。')
    }
    return { ...value, exists: true, file: '当前浏览器 · 此网站的本地存储' }
  }

  // 先成功写入存储再返回；版本冲突时保留其他标签页的新记录。
  const save = (data, revision) => {
    const current = read()
    if (current.revision !== revision) {
      const error = new Error('其他标签页已更新记录，请重新保存。')
      error.current = current
      throw error
    }
    const value = {
      version: 1,
      data: validatePersonalData(data),
      revision: current.revision + 1,
      storeId: current.storeId || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    }
    try {
      storage.setItem(storageKey, JSON.stringify(value))
    } catch {
      throw new Error('浏览器保存失败，可能存储空间不足或被禁用。请下载备份并检查浏览器设置。')
    }
    return { ...value, exists: true, file: current.file }
  }

  return {
    read,
    save,
    migrate(data) {
      const current = read()
      return save(mergePersonalData(current.data, data), current.revision)
    },
  }
}

// 只在明确配置的静态模式启用，不把本机 API 故障静默降级为浏览器保存。
export async function requestBrowserPersonalData(path = '', options = {}) {
  const storage = createBrowserPersonalStorage()
  const write = () => {
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body)
      return storage.save(body.data, body.revision)
    }
    return storage.migrate(JSON.parse(options.body).data)
  }
  if (options.method === 'PUT' || path === '/migrate') {
    if (globalThis.navigator?.locks) return navigator.locks.request('dailydash-pages-personal', write)
    return write()
  }
  return storage.read()
}
