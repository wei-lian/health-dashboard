import { access, cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { publishData } from '../crawler/src/runner.js'
import { paths, root } from '../crawler/src/utils/paths.js'

// CI 使用已提交的公开内容快照，不依赖本机采集目录或个人数据文件。
if (process.argv.includes('--pages')) {
  for (const folder of ['data', 'media'])
    await cp(resolve(root, 'site-content', folder), resolve(paths.public, folder), { recursive: true })
  console.log('已载入 GitHub Pages 公开内容快照。')
}

// 构建前仅同步既有采集结果，绝不隐式发起新一轮抓取。
try {
  await access(paths.output)
  await publishData()
} catch (error) {
  if (error.code === 'ENOENT') console.log('暂无采集数据；请先 npm run crawler。')
  else throw error
}
