import { createPersonalStorage } from './personal-storage.js'

// 只在回环地址同源提供个人数据接口，不开放跨站读取或任意文件写入。
export function personalDataMiddleware(storage = createPersonalStorage()) {
  return async (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (!path?.startsWith('/api/personal-data')) return next()
    const send = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      res.end(JSON.stringify(body))
    }
    try {
      const base = new URL(`http://${req.headers.host}`)
      if (
        !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) ||
        (req.headers.origin && req.headers.origin !== base.origin) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        return send(403, { error: '仅允许本机同源访问' })
      if (path === '/api/personal-data' && req.method === 'GET')
        return send(200, { ...(await storage.read()), file: storage.file })
      if (!['PUT', 'POST'].includes(req.method)) return send(405, { error: '不支持的请求方式' })
      if (
        req.headers.origin !== base.origin ||
        !(req.headers['content-type'] || '').startsWith('application/json')
      )
        return send(403, { error: '写入必须来自本机页面的 JSON 请求' })
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > 5_200_000) return send(413, { error: '文件超过 5MB 限制' })
        chunks.push(chunk)
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      let result
      if (path === '/api/personal-data' && req.method === 'PUT') {
        if (!Number.isSafeInteger(body.revision) || body.revision < 0)
          return send(400, { error: '缺少正确的数据版本号' })
        result = await storage.save(body.data, body.revision)
      } else if (path === '/api/personal-data/migrate' && req.method === 'POST')
        result = await storage.migrate(body.data)
      else return send(404, { error: '接口不存在' })
      return send(200, { ...result, file: storage.file })
    } catch (error) {
      return send(error.status || (error instanceof SyntaxError ? 400 : 422), {
        error: error.message,
        current: error.current ? { ...error.current, file: storage.file } : undefined,
      })
    }
  }
}

// 开发和构建预览都使用相同磁盘数据，不依赖浏览器缓存或启动端口。
export function personalDataPlugin() {
  return {
    name: 'dailydash-personal-data',
    configureServer(server) {
      server.middlewares.use(personalDataMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(personalDataMiddleware())
    },
  }
}
