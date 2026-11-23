import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const root = fileURLToPath(new URL('../../../', import.meta.url))
export const paths = {
  output: resolve(root, 'crawler/output'),
  state: resolve(root, 'crawler/state'),
  logs: resolve(root, 'crawler/logs'),
  data: resolve(root, 'crawler/data'),
  public: resolve(root, 'web-vue/public'),
}

// 采集日期统一按北京时间计算，与电脑所在时区无关。
export function chinaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// 日内容按目标日期稳定轮转，重试不会换另一套内容。
export function dayIndex(date) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000)
}
