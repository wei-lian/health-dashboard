import { access } from 'node:fs/promises'
import { publishData } from '../crawler/src/runner.js'
import { paths } from '../crawler/src/utils/paths.js'

// 构建前仅同步既有采集结果，绝不隐式发起新一轮抓取。
try {
  await access(paths.output)
  await publishData()
} catch (error) {
  if (error.code === 'ENOENT') console.log('暂无采集数据；请先 npm run crawler。')
  else throw error
}
